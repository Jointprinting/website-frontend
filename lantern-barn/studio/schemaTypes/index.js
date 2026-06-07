import siteSettings from "./siteSettings";
import event from "./event";
import product from "./product";

// Drop this folder into a Sanity Studio created with `npm create sanity@latest`
// and import this array in sanity.config.js:  schema: { types: schemaTypes }
export const schemaTypes = [siteSettings, event, product];
