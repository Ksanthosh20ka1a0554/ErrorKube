# Step 1: Use the official Golang image to build the application
FROM golang:1.23.4-alpine as builder

# Set the Current Working Directory inside the container
WORKDIR /app

# Copy the Go Modules manifests
COPY go.mod go.sum ./

# Download all dependencies. Dependencies will be cached if the go.mod and go.sum files are not changed
RUN go mod tidy

# Copy the rest of the application files
COPY . .

# Step 2: Build the Go app
RUN GOOS=linux GOARCH=amd64 go build -o main .

# Step 3: Create a minimal image to run the Go app
FROM alpine:latest  

# Install dependencies required to run the Go app (if any)
RUN apk --no-cache add ca-certificates

# Set the Current Working Directory inside the container
WORKDIR /root/

# Copy the Pre-built binary from the previous stage
COPY --from=builder /app/main .

# Expose the port the app runs on
EXPOSE 8080

# Command to run the application
CMD ["./main"]