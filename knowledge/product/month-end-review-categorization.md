# PRD area C: Categorization

Part of [Month-End Spending Review](month-end-review.md). Rules categorize on arrival; every manual fix can become a rule so fixes shrink over time.

| ID    | Requirement                                                                                                                                                          | Priority |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| C1.1  | Categories have two levels: parent and subcategory (Food › Groceries)                                                                                                | must     |
| C1.2  | Categories can be added, renamed, merged and archived; charts can show either level                                                                                  | must     |
| C1.3  | A rule has conditions, a target category and a priority                                                                                                              | must     |
| C1.4  | Conditions: description (contains / starts with / exact / pattern), amount (exact or range), account, and provider fields such as merchant category code             | must     |
| C1.5  | A rule is shared (all accounts) or tied to one provider profile (only accounts using it); new profiles start with no provider rules                                  | must     |
| C1.6  | Provider rules travel with the provider profile                                                                                                                      | must     |
| C1.7  | When rules overlap, the rule with the most conditions wins; a provider rule beats a shared rule of equal condition count; remaining ties go to manual priority order | must     |
| C1.8  | Changing a transaction's category by hand offers to create or update a rule for that merchant and shows how many past transactions it would recategorize             | must     |
| C1.9  | Before a new or edited rule is saved, the Rules screen lists the past transactions it would change                                                                   | must     |
| C1.10 | "Why this category?" on any transaction shows the rule that set it, or that it was set by hand                                                                       | must     |
| C1.11 | A manual category is never overwritten by a rule                                                                                                                     | must     |
| C1.12 | Rule creation, edits and recategorization never touch transactions in locked months                                                                                  | must     |
| C1.13 | A transaction can be split by amount across several categories; the parts must sum to the original amount                                                            | must     |
| C1.14 | Uncategorized transactions appear in their own list and must be resolved before a month can be closed                                                                | must     |
| C1.15 | A Fees & interest category (Interest charges, Bank fees) exists in the starter templates for the card-side meaning of "interest"                                     | must     |
| C1.16 | A transaction can carry a short note                                                                                                                                 | should   |
| C1.17 | Rules can be reordered, disabled and deleted in an editable list                                                                                                     | must     |

Deferred, not requirements: opt-in online merchant lookup (research first; see the overview). Flow and rules: rules run on import and when a rule is saved (open months only). Refunds reduce spending within their own category.

Assumptions (not in the write-up): C1.11 (a manual category is never overwritten by a rule) and C1.17 (rules can be reordered, disabled, deleted) are proposed; C1.7 reads "a provider rule counts as more specific" as winning over a shared rule with the same number of conditions; "pattern" means regular expression; invalid patterns are rejected on save. Deleting a rule leaves already-assigned categories unchanged.
