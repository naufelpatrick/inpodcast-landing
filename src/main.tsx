import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import Page from './Page';
import type { PageData } from './episodes';
import './index.css';
import './App.css';
const data = JSON.parse(document.getElementById('page-data')!.textContent!) as PageData;
hydrateRoot(document.getElementById('root')!, <React.StrictMode><Page {...data} /></React.StrictMode>);
