# System Design: Ride Verification + Data Integrity

## Q1. Foreign Key Behavior

`Rides.user_id` is a foreign key that refers to `Users.user_id`.
If we try to delete User 101 while Ride 5001 still exists, the database will normally not allow the deletion.
This is because Ride 5001 is still referring to User 101. The foreign key prevents this from creating a broken reference.
So, the foreign key helps maintain data integrity by making sure that a ride cannot refer to a user that does not exist.

## Q2. DELETE Strategy
I would prefer `ON DELETE RESTRICT`.
We should not delete the rides when a user deletes their account because rides and payments are important historical records.
`ON DELETE CASCADE` could delete all the user's rides and related data, which we don't want.
`ON DELETE SET NULL` can keep the ride, but it removes the user reference. I would instead use soft delete or anonymize the user's personal information while keeping the `user_id`.
So, `RESTRICT` is safer for maintaining the relationship and historical data.

## Q3. Historical Data
No, historical rides and payments should not be deleted when a user deletes their account.
Ex. Ride 5001 and Payment 9001 should remain in the database because they are important for transaction history, refunds, reports, and other records.
The user's personal information can be deleted or anonymized, but the ride and payment records should be preserved.

## Q4. Soft Delete vs Hard Delete
I would prefer soft delete or anonymization instead of directly deleting the user.
Ex. we can set `is_deleted = true` and remove or anonymize personal information like name, phone, and email.
This keeps the user record and `user_id`, so old rides can still refer to it.
The main advantage is that historical data remains consistent. The disadvantage is that we still have to store some user record even after the account is deleted.

## Q5. Only 10,000 PINs
There are only 10,000 possible 4-digit PINs, so we cannot give every user a unique PIN if there are millions of users.
Multiple users can have the same PIN. For example, User A and User B can both have `4821`.
The system should not identify a ride using only the PIN. It should also use the ride information like `ride_id`, `captain_id`, and `user_id`.
So, the PIN is used as a verification code, not as a unique identifier.

## Q6. Should ride_pin Be UNIQUE?
No, `ride_pin` should not be unique.
There are only 10,000 possible PINs, so making it unique would not work for millions of users.
Multiple users can have the same PIN. The system should use the PIN together with the ride details to identify and verify the correct ride.

## Q7. PIN Verification
No, we should not search the whole `Users` table using only the PIN.
For example, if the captain enters `4821`, many users may have the same PIN. This could return multiple users and the system may verify the wrong ride.
Instead, we should verify the PIN using the active ride context, such as `ride_id`, `captain_id`, ride status, and the PIN.
This makes sure that the PIN is being checked only for the correct active ride.

## Q8. PIN Collision
If User A and User B both have the same PIN `4821`, the system can still identify the correct ride.
The captain should not enter only the PIN. The system should also check the `ride_id`, `captain_id`, `user_id`, and the ride status.
So even if two users have the same PIN, the PIN will only work for the specific active ride assigned to that captain.

## Q9. PIN Storage Strategy
I would prefer storing the PIN on the `Rides` table instead of the `Users` table.
This way, a new PIN can be generated for each ride. It also means the PIN is only valid for that particular ride.
Storing it on the user is simpler, but the same PIN will be reused for every ride. Generating it dynamically can improve security, but it adds some extra complexity.
So, for this system, I would choose a ride-specific PIN because it gives better security while still being simple to manage.

## Q10. What Indexes Would You Create?
I would create indexes on `Rides(user_id)`, `Rides(captain_id)`, and especially `Rides(captain_id, status)` because we frequently need to find the active ride of a captain.
`Payments(ride_id)` should also be indexed because payments are connected to rides.
`user_id` and `ride_id` are already primary keys, so they are normally indexed automatically.
I would not make `ride_pin` unique. If we need to search by PIN, it can be indexed, but the PIN should still be checked together with the ride context.

## Q11. Primary Key Removal
Normally, the primary key cannot be removed while a foreign key depends on it.
The database will usually prevent this operation because `Rides.user_id` is referencing `Users.user_id`.
This prevents the database from losing the relationship required to maintain data integrity.

## Q12. Removing the Foreign Key and Primary Key
If we first remove the foreign key and then remove the primary key, the database can lose its data integrity.
Ex. multiple users could have the same `user_id`:
101 - Ravi  
101 - Amit  
101 - John
Now if a ride has `user_id = 101`, we cannot know which user the ride belongs to.
This can create incorrect or inconsistent data, so removing these constraints is not safe.

## Q13. Concurrency
Two requests can arrive at the same time to start the same ride.
I would use a transaction with row-level locking or an atomic update so that only one request can change the ride from `WAITING` to `STARTED`.
The first request will successfully start the ride. The second request will find that the ride is no longer in `WAITING` status and will be rejected.
This prevents the same ride from being started twice.

## Q14. Atomic Ride Start
Yes, this approach is safer:
UPDATE rides
SET status = 'STARTED'
WHERE ride_id = ?
  AND captain_id = ?
  AND status = 'WAITING';
Then we check the affected rows.
If the result is `1`, the ride was successfully started. If it is `0`, the ride was already started or the details were incorrect.
This is safer than doing `SELECT` and `UPDATE` separately because both requests could read the ride as `WAITING` before either one updates it. The atomic update avoids this problem.

## Q15. PIN Guessing
Since there are only 10,000 possible PINs, the system should prevent repeated attempts.
I would use rate limiting and set a maximum number of attempts for a ride or captain.
After too many wrong attempts, the PIN verification can be temporarily locked. We should also keep audit logs of failed attempts and track the captain or device making the requests.
This makes it much harder to guess the PIN by trying all possible combinations.

## Final Architecture
The complete flow would be:
### 1. Ride Booking
The rider books a ride and a new ride record is created with:
- `ride_id`
- `user_id`
- `captain_id`
- `status`
- ride-specific PIN
The PIN does not have to be unique because there are only 10,000 possible PINs.

### 2. Captain Assignment
A captain is assigned to the ride and the ride remains in `WAITING` status.
The system can use indexes such as `Rides(captain_id, status)` to quickly find the captain's active ride.

### 3. PIN Verification
When the captain reaches the pickup location, the rider provides the PIN.
The captain sends the PIN along with the ride information to the backend.

The backend checks:
- `ride_id`
- `captain_id`
- `user_id`
- `status = 'WAITING'`
- PIN
The PIN is checked only for that specific ride, so duplicate PINs do not cause a problem.

### 4. Start the Ride
If all the details are correct, the backend performs an atomic update:
UPDATE rides
SET status = 'STARTED'
WHERE ride_id = ?
  AND captain_id = ?
  AND status = 'WAITING';
If one row is affected, the ride is started.
If no row is affected, the request is rejected because the ride may already be started or the details may be incorrect.

### 5. Concurrency
If two requests try to start the same ride at the same time, the atomic update ensures that only one request can change the status from `WAITING` to `STARTED`.
The second request will fail because the status is no longer `WAITING`.

### 6. PIN Security
Since a 4-digit PIN has only 10,000 possibilities, the system should use:
- Rate limiting
- Maximum attempts
- Temporary lockout
- Audit logs
- Captain/device tracking
This prevents repeated PIN guessing.

### 7. User Deletion and Historical Data
If a user deletes their account, I would use soft delete or anonymization instead of deleting the user record directly.
Rides and payments should remain because they are historical records.
Foreign keys should also be maintained so that the relationships between users, rides, and payments remain valid.

### Overall Flow

Rider books ride
        ↓
Ride + PIN created
        ↓
Captain assigned
        ↓
Captain reaches pickup
        ↓
Rider provides PIN
        ↓
Backend checks ride + captain + user + status + PIN
        ↓
      Valid?
     /      \
   Yes       No
    ↓         ↓
START       Reject
RIDE        request
    ↓
Payment and ride history remain consistent