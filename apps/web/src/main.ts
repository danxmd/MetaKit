import '@metakit-app/ui/theme.css';
import { pageTheme } from '@metakit-app/ui/theme';
import { mount } from 'svelte';
import App from './App.svelte';

// Applies the stored appearance before the first paint of the app.
pageTheme();

mount(App, { target: document.getElementById('app')! });
