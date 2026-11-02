# @fossil/shared

Cross-runtime constants and domain enums consumed by both the Express API and the React client.

Written in plain CommonJS so it works natively in Node and via Vite's CJS interop in the browser.

```js
const { USER_ROLES, RFQ_STATUS, formatCurrency } = require('@fossil/shared');
// or, from the client:
import { USER_ROLES, RFQ_STATUS, formatCurrency } from '@fossil/shared';
```

## Modules

| Module                    | Exports                                                                  |
| ------------------------- | ------------------------------------------------------------------------ |
| `constants/roles`         | `USER_ROLES`, `USER_ROLE_VALUES`, `USER_ROLE_OPTIONS`                    |
| `constants/currencies`    | `CURRENCIES`, `DEFAULT_CURRENCY`, `SUPPORTED_CURRENCY_CODES`, `formatCurrency` |
| `constants/statuses`      | `REQUISITION_STATUS`, `RFQ_STATUS`, `QUOTATION_STATUS`, `PURCHASE_ORDER_STATUS`, `DELIVERY_STATUS`, `USER_STATUS`, `SUPPLIER_STATUS` |
| `constants/regions`       | `PROVINCES`, `BANKS`, `ACCOUNT_TYPES`                                    |
| `constants/catalog`       | `SUPPLIER_CATEGORIES`, `UNITS_OF_MEASUREMENT`, `UNIT_OPTIONS`            |
