# Investments feature

Investment data refresh orchestration belongs in this feature directory.

- UI components remain in `components/finance` while the current screens are gradually decomposed.
- `services/refreshInvestmentState.ts` owns external price synchronization and account-value aggregation.
- Storage remains owned by the application state layer, so services return a new `FinanceState` instead of writing to localStorage or reloading the page.
- The existing backup format and localStorage keys are intentionally unchanged.
