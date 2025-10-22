import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import App from './App';
import { FileProvider } from './context/FileContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <FileProvider>
    <App />
  </FileProvider>
);
