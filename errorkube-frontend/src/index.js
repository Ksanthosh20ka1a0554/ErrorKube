import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './components/App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <div style={{ display : "flex", backgroundColor :"#d4eaf7"}}>
              <img src="/images/Error_Kube-logo.png" style={{ width:"100px", padding: "5px"}} alt="ErrorKube logo"/>
              </div>
    <App />
  </React.StrictMode>
);

reportWebVitals();
