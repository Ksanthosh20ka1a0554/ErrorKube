import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import FilterComponent from "./FilterComponent";
import ErrorTable from "./ErrorTable";
import ErrorDetails from "./ErrorDetails";

const App = () => {
  const [errorEvents, setErrorEvents] = useState([]);
  const [filteredData, setFilteredData] = useState([]);

  // Function to decode Base64 to JSON
  const decodeBase64Data = (base64String) => {
    const decodedString = atob(base64String); // Decode Base64 to string
    try {
      return JSON.parse(decodedString); // Parse the decoded string to JSON
    } catch (e) {
      console.error("Error parsing decoded string:", e);
      return decodedString; // Return as is if parsing fails
    }
  };

  // Function to deduplicate events based on their UID
  const deduplicateEvents = (events) => {
    const uniqueEvents = [];
    const seenUids = new Set();

    events.forEach((event) => {
      const uid = event?.data?.metadata?.uid || event?.uid;
      if (!seenUids.has(uid)) {
        uniqueEvents.push(event);
        seenUids.add(uid);
      }
    });

    return uniqueEvents;
  };

  useEffect(() => {
    // Fetch data from /api/events
    const fetchApiEvents = async () => {
      try {
        const response = await fetch("/api/events");
        if (response.ok) {
          const data = await response.json();

          // Decode Data field in each event
          const decodedEvents = data.map((event) => {
            if (event.data && event.data.Data) {
              const decodedData = decodeBase64Data(event.data.Data);
              return { ...event, data: decodedData };
            }
            return event;
          });

          // Deduplicate and sort events
          const uniqueEvents = deduplicateEvents(decodedEvents);
          const sortedEvents = uniqueEvents.sort(
            (a, b) =>
              new Date(b.data.metadata.creationTimestamp) -
              new Date(a.data.metadata.creationTimestamp)
          );

          setErrorEvents(sortedEvents);
          setFilteredData(sortedEvents); // Initially set filtered data to all sorted events
        } else {
          console.error(
            `API Error: ${response.status} - ${response.statusText}`
          );
        }
      } catch (error) {
        console.error("Error fetching API events:", error);
      }
    };

    // Establish WebSocket connection
    const ws = new WebSocket("/events");
    ws.onopen = () => {
      console.log("WebSocket connection established.");
    };
    ws.onmessage = (event) => {
      const newEvent = JSON.parse(event.data);

      // Decode new WebSocket event
      if (newEvent.data && newEvent.data.Data) {
        newEvent.data = decodeBase64Data(newEvent.data.Data);
      }

      setErrorEvents((prev) => {
        // Combine new event with existing ones and deduplicate
        const updatedEvents = deduplicateEvents([...prev, newEvent]);

        // Sort events by creationTimestamp
        const sortedUpdatedEvents = updatedEvents.sort(
          (a, b) =>
            new Date(b.data.metadata.creationTimestamp) -
            new Date(a.data.metadata.creationTimestamp)
        );

        setFilteredData(sortedUpdatedEvents); // Update filtered data with sorted events
        return sortedUpdatedEvents;
      });
    };
    ws.onerror = (error) => {
      console.error("WebSocket Error:", error);
    };
    ws.onclose = () => {
      console.log("WebSocket connection closed.");
    };

    // Fetch API events when component mounts
    fetchApiEvents();

    // Cleanup WebSocket connection on component unmount
    return () => {
      ws.close();
    };
  }, []);

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <div style={{ padding: "10px" }}>
              <h1>Cluster Error Events</h1>
              <FilterComponent data={errorEvents} onFilter={setFilteredData} />
              <ErrorTable data={filteredData} />
            </div>
          }
        />
        <Route
          path="/errorDetails"
          element={<ErrorDetails data={errorEvents} />}
        />
      </Routes>
    </Router>
  );
};

export default App;