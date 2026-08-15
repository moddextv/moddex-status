import { pageModel } from './model.js';
import { render } from './templates.js';

export const renderPage = (snapshot) => {
  return render('page', pageModel(snapshot, Date.now()));
};
