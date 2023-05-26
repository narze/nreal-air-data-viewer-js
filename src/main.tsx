// import React from "react"
// import ReactDOM from "react-dom/client"
// import App from "./App.tsx"
import "./index.css"
import { setReportHandler, requestNrealAccess } from "./usb.ts"

// ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
//   <React.StrictMode>
//     <App />
//   </React.StrictMode>
// )

Object.assign(window, {
  setReportHandler: setReportHandler,
  requestNrealAccess: requestNrealAccess,
})
