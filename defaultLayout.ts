// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// import { LayoutData } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
// import { defaultPlaybackConfig } from "@foxglove/studio-base/providers/CurrentLayoutProvider/reducers";

// /**
//  * This is loaded when the user has no layout selected on application launch
//  * to avoid presenting the user with a blank layout.
//  */

import { LayoutData } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";

const fetchJSON = (url: string): Promise<LayoutData> => {
  return fetch(url, { mode: 'no-cors'})
    .then(response => response.json())
    .catch(error => error);
};

let url = "/RosbotTeleop.json?timestamp=" + Date.now();
let defaultLayout: LayoutData;
fetchJSON(url)
  .then(data => {
    defaultLayout = data;
  });

export { defaultLayout };
