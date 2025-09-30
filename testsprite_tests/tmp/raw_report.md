
# TestSprite AI Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** tg-escrow-miniapp
- **Date:** 2025-09-30
- **Prepared by:** TestSprite AI Team

---

## 2️⃣ Requirement Validation Summary

#### Test auth_telegram_login
- **Test Name:** Telegram Authentication Flow
- **Test Code:** [auth_telegram_login_Telegram_Authentication_Flow.py](./auth_telegram_login_Telegram_Authentication_Flow.py)
- **Test Error:** 
Browser Console Logs:
[ERROR] Warning: Extra attributes from the server: %s%s style 
    at html
    at RootLayout (Server)
    at RedirectErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/redirect-boundary.js:74:9)
    at RedirectBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/redirect-boundary.js:82:11)
    at NotFoundErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/not-found-boundary.js:76:9)
    at NotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/not-found-boundary.js:84:11)
    at DevRootNotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/dev-root-not-found-boundary.js:33:11)
    at ReactDevOverlay (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/react-dev-overlay/app/ReactDevOverlay.js:87:9)
    at HotReload (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/react-dev-overlay/app/hot-reloader-client.js:321:11)
    at Router (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/app-router.js:207:11)
    at ErrorBoundaryHandler (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/error-boundary.js:113:9)
    at ErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/error-boundary.js:160:11)
    at AppRouter (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/app-router.js:585:13)
    at ServerRoot (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/app-index.js:112:27)
    at Root (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/app-index.js:117:11) (at webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/app-index.js:32:21)
[WARNING] Image with src "/logo.png" has either width or height modified, but not the other. If you use CSS to change the size of your image, also include the styles 'width: "auto"' or 'height: "auto"' to maintain the aspect ratio. (at webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/shared/lib/utils/warn-once.js:15:20)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/1074f58c-3570-47fa-a4e1-95a6012c0eb4/de3dd3d9-a967-4714-a657-17db75e6c3ac
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test seller_create_escrow
- **Test Name:** Seller Creates Escrow Transaction
- **Test Code:** [seller_create_escrow_Seller_Creates_Escrow_Transaction.py](./seller_create_escrow_Seller_Creates_Escrow_Transaction.py)
- **Test Error:** 
Browser Console Logs:
[ERROR] Warning: Extra attributes from the server: %s%s style 
    at html
    at RootLayout (Server)
    at RedirectErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/redirect-boundary.js:74:9)
    at RedirectBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/redirect-boundary.js:82:11)
    at NotFoundErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/not-found-boundary.js:76:9)
    at NotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/not-found-boundary.js:84:11)
    at DevRootNotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/dev-root-not-found-boundary.js:33:11)
    at ReactDevOverlay (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/react-dev-overlay/app/ReactDevOverlay.js:87:9)
    at HotReload (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/react-dev-overlay/app/hot-reloader-client.js:321:11)
    at Router (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/app-router.js:207:11)
    at ErrorBoundaryHandler (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/error-boundary.js:113:9)
    at ErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/error-boundary.js:160:11)
    at AppRouter (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/app-router.js:585:13)
    at ServerRoot (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/app-index.js:112:27)
    at Root (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/app-index.js:117:11) (at webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/app-index.js:32:21)
[WARNING] Image with src "/logo.png" has either width or height modified, but not the other. If you use CSS to change the size of your image, also include the styles 'width: "auto"' or 'height: "auto"' to maintain the aspect ratio. (at webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/shared/lib/utils/warn-once.js:15:20)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/1074f58c-3570-47fa-a4e1-95a6012c0eb4/8d611856-ea1e-4979-afc9-c3f303619099
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test buyer_join_escrow
- **Test Name:** Buyer Joins Escrow Transaction
- **Test Code:** [buyer_join_escrow_Buyer_Joins_Escrow_Transaction.py](./buyer_join_escrow_Buyer_Joins_Escrow_Transaction.py)
- **Test Error:** 
Browser Console Logs:
[ERROR] Warning: Extra attributes from the server: %s%s style 
    at html
    at RootLayout (Server)
    at RedirectErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/redirect-boundary.js:74:9)
    at RedirectBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/redirect-boundary.js:82:11)
    at NotFoundErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/not-found-boundary.js:76:9)
    at NotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/not-found-boundary.js:84:11)
    at DevRootNotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/dev-root-not-found-boundary.js:33:11)
    at ReactDevOverlay (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/react-dev-overlay/app/ReactDevOverlay.js:87:9)
    at HotReload (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/react-dev-overlay/app/hot-reloader-client.js:321:11)
    at Router (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/app-router.js:207:11)
    at ErrorBoundaryHandler (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/error-boundary.js:113:9)
    at ErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/error-boundary.js:160:11)
    at AppRouter (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/app-router.js:585:13)
    at ServerRoot (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/app-index.js:112:27)
    at Root (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/app-index.js:117:11) (at webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/app-index.js:32:21)
[WARNING] Image with src "/logo.png" has either width or height modified, but not the other. If you use CSS to change the size of your image, also include the styles 'width: "auto"' or 'height: "auto"' to maintain the aspect ratio. (at webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/shared/lib/utils/warn-once.js:15:20)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/1074f58c-3570-47fa-a4e1-95a6012c0eb4/3499de49-a94b-4307-b2bd-73c9cbbdec36
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test payment_receipt_upload
- **Test Name:** Payment Receipt Upload
- **Test Code:** [payment_receipt_upload_Payment_Receipt_Upload.py](./payment_receipt_upload_Payment_Receipt_Upload.py)
- **Test Error:** 
Browser Console Logs:
[ERROR] Warning: Extra attributes from the server: %s%s style 
    at html
    at RootLayout (Server)
    at RedirectErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/redirect-boundary.js:74:9)
    at RedirectBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/redirect-boundary.js:82:11)
    at NotFoundErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/not-found-boundary.js:76:9)
    at NotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/not-found-boundary.js:84:11)
    at DevRootNotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/dev-root-not-found-boundary.js:33:11)
    at ReactDevOverlay (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/react-dev-overlay/app/ReactDevOverlay.js:87:9)
    at HotReload (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/react-dev-overlay/app/hot-reloader-client.js:321:11)
    at Router (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/app-router.js:207:11)
    at ErrorBoundaryHandler (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/error-boundary.js:113:9)
    at ErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/error-boundary.js:160:11)
    at AppRouter (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/app-router.js:585:13)
    at ServerRoot (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/app-index.js:112:27)
    at Root (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/app-index.js:117:11) (at webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/app-index.js:32:21)
[WARNING] Image with src "/logo.png" has either width or height modified, but not the other. If you use CSS to change the size of your image, also include the styles 'width: "auto"' or 'height: "auto"' to maintain the aspect ratio. (at webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/shared/lib/utils/warn-once.js:15:20)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/1074f58c-3570-47fa-a4e1-95a6012c0eb4/e4ec1f3d-f388-489b-81f0-ac9920a6c6d0
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test admin_payment_confirmation
- **Test Name:** Admin Payment Confirmation
- **Test Code:** [admin_payment_confirmation_Admin_Payment_Confirmation.py](./admin_payment_confirmation_Admin_Payment_Confirmation.py)
- **Test Error:** 
Browser Console Logs:
[ERROR] Warning: Extra attributes from the server: %s%s style 
    at html
    at RootLayout (Server)
    at RedirectErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/redirect-boundary.js:74:9)
    at RedirectBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/redirect-boundary.js:82:11)
    at NotFoundErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/not-found-boundary.js:76:9)
    at NotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/not-found-boundary.js:84:11)
    at DevRootNotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/dev-root-not-found-boundary.js:33:11)
    at ReactDevOverlay (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/react-dev-overlay/app/ReactDevOverlay.js:87:9)
    at HotReload (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/react-dev-overlay/app/hot-reloader-client.js:321:11)
    at Router (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/app-router.js:207:11)
    at ErrorBoundaryHandler (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/error-boundary.js:113:9)
    at ErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/error-boundary.js:160:11)
    at AppRouter (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/app-router.js:585:13)
    at ServerRoot (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/app-index.js:112:27)
    at Root (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/app-index.js:117:11) (at webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/app-index.js:32:21)
[WARNING] Image with src "/logo.png" has either width or height modified, but not the other. If you use CSS to change the size of your image, also include the styles 'width: "auto"' or 'height: "auto"' to maintain the aspect ratio. (at webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/shared/lib/utils/warn-once.js:15:20)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/1074f58c-3570-47fa-a4e1-95a6012c0eb4/2572a821-7055-44e8-8327-cf57104a1c69
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test escrow_expiration
- **Test Name:** Escrow Expiration Handling
- **Test Code:** [escrow_expiration_Escrow_Expiration_Handling.py](./escrow_expiration_Escrow_Expiration_Handling.py)
- **Test Error:** 
Browser Console Logs:
[ERROR] Warning: Extra attributes from the server: %s%s style 
    at html
    at RootLayout (Server)
    at RedirectErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/redirect-boundary.js:74:9)
    at RedirectBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/redirect-boundary.js:82:11)
    at NotFoundErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/not-found-boundary.js:76:9)
    at NotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/not-found-boundary.js:84:11)
    at DevRootNotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/dev-root-not-found-boundary.js:33:11)
    at ReactDevOverlay (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/react-dev-overlay/app/ReactDevOverlay.js:87:9)
    at HotReload (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/react-dev-overlay/app/hot-reloader-client.js:321:11)
    at Router (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/app-router.js:207:11)
    at ErrorBoundaryHandler (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/error-boundary.js:113:9)
    at ErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/error-boundary.js:160:11)
    at AppRouter (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/app-router.js:585:13)
    at ServerRoot (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/app-index.js:112:27)
    at Root (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/app-index.js:117:11) (at webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/app-index.js:32:21)
[WARNING] Image with src "/logo.png" has either width or height modified, but not the other. If you use CSS to change the size of your image, also include the styles 'width: "auto"' or 'height: "auto"' to maintain the aspect ratio. (at webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/shared/lib/utils/warn-once.js:15:20)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/1074f58c-3570-47fa-a4e1-95a6012c0eb4/07f6066e-380f-4865-886e-3cb59e91f2b6
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test product_image_display
- **Test Name:** Product Image Display Fix
- **Test Code:** [product_image_display_Product_Image_Display_Fix.py](./product_image_display_Product_Image_Display_Fix.py)
- **Test Error:** 
Browser Console Logs:
[ERROR] Warning: Extra attributes from the server: %s%s style 
    at html
    at RootLayout (Server)
    at RedirectErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/redirect-boundary.js:74:9)
    at RedirectBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/redirect-boundary.js:82:11)
    at NotFoundErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/not-found-boundary.js:76:9)
    at NotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/not-found-boundary.js:84:11)
    at DevRootNotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/dev-root-not-found-boundary.js:33:11)
    at ReactDevOverlay (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/react-dev-overlay/app/ReactDevOverlay.js:87:9)
    at HotReload (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/react-dev-overlay/app/hot-reloader-client.js:321:11)
    at Router (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/app-router.js:207:11)
    at ErrorBoundaryHandler (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/error-boundary.js:113:9)
    at ErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/error-boundary.js:160:11)
    at AppRouter (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/app-router.js:585:13)
    at ServerRoot (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/app-index.js:112:27)
    at Root (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/app-index.js:117:11) (at webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/app-index.js:32:21)
[WARNING] Image with src "/logo.png" has either width or height modified, but not the other. If you use CSS to change the size of your image, also include the styles 'width: "auto"' or 'height: "auto"' to maintain the aspect ratio. (at webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/shared/lib/utils/warn-once.js:15:20)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/1074f58c-3570-47fa-a4e1-95a6012c0eb4/990c134e-bb7c-4f7d-872f-beb5d60b8830
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test chat_functionality
- **Test Name:** Escrow Chat System
- **Test Code:** [chat_functionality_Escrow_Chat_System.py](./chat_functionality_Escrow_Chat_System.py)
- **Test Error:** 
Browser Console Logs:
[ERROR] Warning: Extra attributes from the server: %s%s style 
    at html
    at RootLayout (Server)
    at RedirectErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/redirect-boundary.js:74:9)
    at RedirectBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/redirect-boundary.js:82:11)
    at NotFoundErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/not-found-boundary.js:76:9)
    at NotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/not-found-boundary.js:84:11)
    at DevRootNotFoundBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/dev-root-not-found-boundary.js:33:11)
    at ReactDevOverlay (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/react-dev-overlay/app/ReactDevOverlay.js:87:9)
    at HotReload (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/react-dev-overlay/app/hot-reloader-client.js:321:11)
    at Router (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/app-router.js:207:11)
    at ErrorBoundaryHandler (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/error-boundary.js:113:9)
    at ErrorBoundary (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/error-boundary.js:160:11)
    at AppRouter (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/components/app-router.js:585:13)
    at ServerRoot (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/app-index.js:112:27)
    at Root (webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/app-index.js:117:11) (at webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/client/app-index.js:32:21)
[WARNING] Image with src "/logo.png" has either width or height modified, but not the other. If you use CSS to change the size of your image, also include the styles 'width: "auto"' or 'height: "auto"' to maintain the aspect ratio. (at webpack-internal:///(app-pages-browser)/./node_modules/.pnpm/next@14.2.32_react-dom@18.3.1_react@18.3.1/node_modules/next/dist/shared/lib/utils/warn-once.js:15:20)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/1074f58c-3570-47fa-a4e1-95a6012c0eb4/2f250d3a-74ef-4ab8-8ed5-caae77935963
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---


## 3️⃣ Coverage & Matching Metrics

- **0.00** of tests passed

| Requirement        | Total Tests | ✅ Passed | ❌ Failed  |
|--------------------|-------------|-----------|------------|
| ...                | ...         | ...       | ...        |
---


## 4️⃣ Key Gaps / Risks
{AI_GNERATED_KET_GAPS_AND_RISKS}
---