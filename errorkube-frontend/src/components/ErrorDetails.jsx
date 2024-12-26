import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import './ErrorDetailsPage.css'; // Import the new CSS for styling

const ErrorDetails = () => {
  const { state } = useLocation(); // Access state from navigate()
  const navigate = useNavigate();
  if (!state || !state.event) {
    return <div className="error-message">Event not found or invalid data provided</div>;
  }

  const eventDetails = state.event;

  return (
    <div>
    <div className="breadcrumb">
        <span onClick={() => navigate('/')} className="breadcrumb-item">Home</span> &gt;
        <span className="breadcrumb-item active">Error Details</span>
      </div>
    <div className="error-details-container">
      <h1 className="error-title">Error Details</h1>

      <div className="error-info-grid">
        <div className="info-column">
          <div className="card">
            <h2 className="section-title">General Information</h2>
            <div className="card-content">
              <p><strong>Event ID:</strong> {eventDetails.uid}</p>
              <p><strong>Namespace:</strong> {eventDetails.data.metadata.namespace}</p>
              <p><strong>Name:</strong> {eventDetails.data.metadata.name}</p>
              <p><strong>Kind:</strong> {eventDetails.data.involvedObject.kind}</p>
              <p><strong>Created At:</strong> {new Date(eventDetails.data.metadata.creationTimestamp).toLocaleString()}</p>
            </div>
          </div>

          <div className="card">
            <h2 className="section-title">Source Information</h2>
            <div className="card-content">
              <p><strong>Reporting Component:</strong> {eventDetails.data.reportingComponent}</p>
              <p><strong>Host:</strong> {eventDetails.data.source.host}</p>
            </div>
          </div>
        </div>

        <div className="info-column">
          <div className="card">
            <h2 className="section-title">Error Information</h2>
            <div className="card-content">
              <p><strong>Reason:</strong> {eventDetails.data.reason}</p>
              <p><strong>Message:</strong> {eventDetails.data.message}</p>
              <p><strong>Event Type:</strong> {eventDetails.data.type}</p>
              <p><strong>First Occurrence:</strong> {new Date(eventDetails.data.firstTimestamp).toLocaleString()}</p>
              <p><strong>Last Occurrence:</strong> {new Date(eventDetails.data.lastTimestamp).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
};

export default ErrorDetails;