// /docs/components-tree.md
# Component Tree

- `Layout.js` (App shell with sidebar, header, and content area)
  - `Toaster` (from shadcn/ui, for notifications)
  - Pages (rendered as `children`)
    - `Dashboard.js`
      - `StatCard.js` (inline)
    - `Assets.js`
      - `useToast`
    - `AssetForm.js`
      - `useToast`
    - `AssetDetail.js`
      - `InfoField.js` (inline)
      - `VendorCard.js` (inline)
      - `WarrantyCard.js` (inline)
    - `Categories.js`
      - `DeleteGuardDialog.js`
      - `useToast`
    - `Locations.js`
      - `DeleteGuardDialog.js`
    - `Vendors.js`
      - `DeleteGuardDialog.js`
    - `Warranties.js`
- `DeleteGuardDialog.js` (Reusable modal for safe-deletion flows)
