package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var (
	upgrader = websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	mongoDB  *mongo.Collection
)

func main() {
	// Initialize MongoDB client and apply indexing
	initMongoDB()

	// Set up HTTP router and server
	r := mux.NewRouter()
	r.HandleFunc("/events", handleWebSocket)
	r.HandleFunc("/api/events", handleGetAllEvents)
	r.HandleFunc("/api/events/{uid}", handleGetEventByUID).Methods("GET")

	// Wrap router with CORS middleware
	handlerWithCORS := enableCORS(r)

	// Handle graceful shutdown
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go handleShutdown(cancel)

	log.Println("Starting WebSocket and REST API server on :8080")
	server := &http.Server{
		Addr:    ":8080",
		Handler: handlerWithCORS,
	}

	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	<-ctx.Done() // Wait for shutdown signal
	log.Println("Shutting down server...")

	// Graceful shutdown of the HTTP server
	if err := server.Shutdown(context.Background()); err != nil {
		log.Printf("Server shutdown error: %v", err)
	}
}

func enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		// Handle preflight OPTIONS request
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func handleShutdown(cancel context.CancelFunc) {
	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
	<-sigs
	log.Println("Received shutdown signal. Cleaning up...")
	cancel()
}

// Initialize MongoDB connection and apply indexing
func initMongoDB() {
	mongoURI := "mongodb://mongo-service.default.svc.cluster.local:27017" // MongoDB service URL in Kubernetes
	client, err := mongo.Connect(context.TODO(), options.Client().ApplyURI(mongoURI))
	if err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}

	// Ensure connection is established
	err = client.Ping(context.TODO(), nil)
	if err != nil {
		log.Fatalf("MongoDB connection error: %v", err)
	}

	mongoDB = client.Database("k8sEvents").Collection("events")
	log.Println("Connected to MongoDB.")

	// Apply index on UID field for faster lookups
	indexModel := mongo.IndexModel{
		Keys: bson.M{"uid": 1},
		Options: options.Index().
			SetUnique(true),
	}
	_, err = mongoDB.Indexes().CreateOne(context.TODO(), indexModel)
	if err != nil {
		log.Fatalf("Failed to create index on UID: %v", err)
	}
	log.Println("Index created on UID field.")
}

// WebSocket handler to listen for events
func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	clientset, err := initKubernetesClient()
	if err != nil {
		log.Printf("Failed to initialize Kubernetes client: %v", err)
		return
	}

	log.Println("Listening for Kubernetes warning events...")

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Configure shared informer factory with field selector for "Warning" events
	fieldSelector := "type=Warning"
	sharedInformerFactory := informers.NewSharedInformerFactoryWithOptions(
		clientset,
		0,
		informers.WithTweakListOptions(func(options *metav1.ListOptions) {
			options.FieldSelector = fieldSelector
		}),
	)

	eventInformer := sharedInformerFactory.Core().V1().Events().Informer()

	eventInformer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			event, ok := obj.(*v1.Event)
			if !ok {
				log.Println("Failed to cast object to Event.")
				return
			}

			// Marshal event to raw JSON
			rawBytes, err := json.Marshal(event)
			if err != nil {
				log.Printf("Failed to marshal event: %v", err)
				return
			}

			// Create MongoDB document
			doc := map[string]interface{}{
				"uid":  event.UID,
				"data": json.RawMessage(rawBytes),
			}

			// Save to MongoDB
			if err := saveEventToMongoDB(doc); err != nil {
				log.Printf("Error saving event to MongoDB: %v", err)
				return
			}

			// Send to WebSocket
			if err := conn.WriteJSON(doc); err != nil {
				log.Printf("Failed to send event to WebSocket client: %v", err)
			}
		},
	})

	sharedInformerFactory.Start(ctx.Done())
	cache.WaitForCacheSync(ctx.Done(), eventInformer.HasSynced)
	<-ctx.Done()
}

// Save the event to MongoDB
func saveEventToMongoDB(doc map[string]interface{}) error {
	_, err := mongoDB.InsertOne(context.TODO(), doc)
	if err != nil && mongo.IsDuplicateKeyError(err) {
		log.Printf("Event with UID %v already exists in MongoDB.", doc["uid"])
		return nil
	}
	return err
}

// Fetch all events from MongoDB (historical data)
func handleGetAllEvents(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	cursor, err := mongoDB.Find(context.TODO(), bson.M{})
	if err != nil {
		http.Error(w, "Error retrieving events from MongoDB", http.StatusInternalServerError)
		log.Printf("Error retrieving events: %v", err)
		return
	}
	defer cursor.Close(context.TODO())

	var events []map[string]interface{}
	for cursor.Next(context.TODO()) {
		var event map[string]interface{}
		if err := cursor.Decode(&event); err != nil {
			log.Printf("Error decoding MongoDB document: %v", err)
			continue
		}
		delete(event, "_id") // Remove the "_id" field
		events = append(events, event)
	}

	if err := json.NewEncoder(w).Encode(events); err != nil {
		http.Error(w, "Error encoding events to JSON", http.StatusInternalServerError)
		log.Printf("Error encoding events: %v", err)
	}
}

// Fetch event by UID from MongoDB
func handleGetEventByUID(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	uid := vars["uid"]

	w.Header().Set("Content-Type", "application/json")

	filter := bson.M{"uid": uid}
	var event map[string]interface{}
	err := mongoDB.FindOne(context.TODO(), filter).Decode(&event)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			http.Error(w, "Event not found", http.StatusNotFound)
		} else {
			http.Error(w, "Error retrieving event from MongoDB", http.StatusInternalServerError)
		}
		log.Printf("Error retrieving event: %v", err)
		return
	}

	delete(event, "_id") // Remove the "_id" field
	if err := json.NewEncoder(w).Encode(event); err != nil {
		http.Error(w, "Error encoding event to JSON", http.StatusInternalServerError)
		log.Printf("Error encoding event: %v", err)
	}
}

// Initialize Kubernetes client
func initKubernetesClient() (*kubernetes.Clientset, error) {
	config, err := rest.InClusterConfig()
	if err != nil {
		return nil, err
	}
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		return nil, err
	}
	return clientset, nil
}