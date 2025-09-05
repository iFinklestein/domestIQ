// /docs/api/sdk-usage.md
# API Usage: base44 Entity SDK

The base44 platform provides a client-side JavaScript SDK to interact with your entities. All methods are asynchronous and return Promises.

### Authentication
Authentication is handled automatically by the platform. The SDK uses the logged-in user's session for all requests. You can get the current user's data like this:

```javascript
import { User } from '@/entities/User';

async function getUser() {
  try {
    const me = await User.me();
    console.log(me.email, me.full_name);
  } catch (error) {
    // User is not logged in
    console.error("Not authenticated");
  }
}
CRUD Operations
Here are examples using the Asset entity. The same patterns apply to Category, Location, etc.
import { Asset } from '@/entities/Asset';
1. Create
const newAsset = await Asset.create({
  name: 'MacBook Pro 16"',
  serialNumber: 'C02ZJ12MLVDQ',
  purchasePrice: 2499.99,
  tags: ['work', 'laptop']
});
console.log(newAsset.id); // The new record, including its generated ID
2. Read (Get Single Record)
const asset = await Asset.get('some-asset-id');
console.log(asset.name);
3. Update
const updatedAsset = await Asset.update('some-asset-id', {
  notes: 'Updated note: screen was replaced.',
  condition: 'Fair'
});
4. Delete
await Asset.delete('some-asset-id');
// The record is now deleted.
5. List & Filter The list() and filter() methods are powerful ways to query records.
•	list(sort, limit, offset): Get multiple records.
•	filter(filters, sort, limit, offset): Get records matching specific criteria.
Sorting:
•	'-created_date': Sort by creation date, descending (newest first).
•	'name': Sort by name, ascending (A-Z).
Pagination:
•	limit: Number of records to return (e.g., 20).
•	offset: Number of records to skip (e.g., 40 to get the third page of 20).
Filtering: The filters object uses field names as keys.
Examples:
// Get the 10 most recently created assets
const recentAssets = await Asset.list('-created_date', 10);

// Get assets in a specific category, sorted by name
const kitchenAssets = await Asset.filter(
  { categoryId: 'category-id-for-kitchen' }, 
  'name'
);

// Find an asset by serial number (should be unique)
const found = await Asset.filter({ serialNumber: 'C02ZJ12MLVDQ' });
const asset = found.length > 0 ? found[0] : null;

// Paginate through assets
const page = 2;
const limit = 25;
const offset = (page - 1) * limit;
const pagedAssets = await Asset.list('-purchaseDate', limit, offset);

```markdown
