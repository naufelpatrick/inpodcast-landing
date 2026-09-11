import { renderToString } from 'react-dom/server';
import Page from './Page';
import type { PageData } from './episodes';
export function render(data: PageData) { return renderToString(<Page {...data} />); }
