# SIMARC Desktop: TiDB Cloud Migration Plan

## Migration Status
- **Current State**: Database lokal (MariaDB 10.11.14) fully operational, 18 modules working
- **Target**: TiDB Cloud (Distributed SQL, MySQL-compatible)
- **Migration Status**: Planning phase - not yet executed
- **Estimated Effort**: 8+ working days
- **Risk Level**: High (application currently 100% working with local DB)

## Current Database Configuration
- **Host**: localhost (127.0.0.1)
- **Port**: 3306 (MariaDB)
- **Database**: simarc
- **User**: 419auXgnyEgUPJS.root (TiDB Cloud credentials in .env, not yet connected)
- **Backup**: `simarc.sql` (phpMyAdmin SQL dump, complete structure + data)

## Export Status ✅
- **Database structure**: Exported in `simarc.sql` (550+ tables/records)
- **Data arsip**: 250+ records exported with full relasi
- **Users, roles, lokasi**: Fully exported
- **Backup file**: `simarc.sql` exists and is complete

## TiDB Cloud Connection Details (from .env)
- **Host**: gateway01.ap-northeast-1.prod.aws.tidibcloud.com
- **Port**: 4000
- **Database**: simarc
- **User**: 419auXgnyEgUPJS.root
- **Password**: 6QK6gILapucgLcGI
- **TLS**: skip-verify

## Migration Steps Plan

### Phase 1: Preparation (2 hari)
1. ✅ **Export database lokal** - SEDANG DONE (simarc.sql already contains complete export)
2. Verify TiDB Cloud connectivity from development environment
3. Create TiDB Cloud database `simarc` (via TiDB Cloud console)
4. Test basic connectivity with provided credentials

### Phase 2: Schema Migration (3 hari)
1. Import `simarc.sql` ke TiDB Cloud
2. Resolve any MySQL/MariaDB-specific syntax incompatibilities
3. TiDB is MySQL-compatible, but some functions may need adjustment:
   - Check stored procedures/triggers
   - Verify character set/collation consistency (utf8mb4_unicode_ci)
   - Test AutoIncrement/UUID generation
4. Validate all 18 module tables import correctly

### Phase 3: Data Validation (2 hari)
1. Count records per table and compare local vs TiDB
2. Verify relationships (foreign keys, join tables) work correctly
3. Test critical functionality:
   - Login/authentication (admin user)
   - Arsip CRUD operations
   - Role-based access control
   - Master data (units, classifications, locations)
4. Fix any data integrity issues

### Phase 4: Application Configuration (1 hari)
1. Update `.env` with TiDB Cloud connection parameters
2. Test application startup with new database
3. Run full test suite (if available)
4. Verify all API endpoints work

### Phase 5: Rollback Plan (1 hari)
1. Document original local database connection string
2. Keep local MariaDB running during transition
3. Test rollback procedure
4. Document decision point for final switch

### Phase 6: Cutover (1 hari)
1. Switch application to use TiDB Cloud
2. Monitor for errors
3. Verify all 18 modules functioning
4. Declare migration complete OR revert to local

## Technical Considerations

### TiDB Compatibility
- ✅ TiDB is wire-level MySQL 8.0 compatible
- ✅ GORM MySQL driver should work with minimal changes
- ⚠️ Some MariaDB-specific features may need adjustment
- ⚠️ TiDB Cloud uses `skip-verify` TLS by default (configured in .env)

### Potential Issues
1. **Activity logs** (250+ entries) - need UUID format compatibility
2. **Role/Permission system** - join tables may need recreation
3. **Archive data** (250+ arsip records) - verify file paths and references
4. **Backup/restore functionality** - may need TiDB-compatible alternatives
5. **Offline mode** - application currently uses SQLite fallback; needs review

### Files That Need Attention
- `.env` - Update DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD
- `internal/database/database.go` - May need TLS/configuration adjustments
- `simarc.sql` - May need TiDB-specific imports

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Connectivity failure | High | Keep local DB as fallback; test connectivity first |
| Data corruption | High | Full backup before import; validate all records |
| Schema incompatibility | Medium | Test import on staging TiDB first |
| Application errors | Medium | Comprehensive testing of all 18 modules |
| Permission/role mismatch | Medium | Test login and ACL thoroughly |
| TLS/SSL issues | Low | Already configured as `skip-verify` in .env |

## Decision Matrix

### Option A: Stay with Local MariaDB
- **Pros**: 
  - Already 100% working, all 18 modules functional
  - No migration risk or downtime
  - Existing backup `simarc.sql` is complete
  - Zero cost (infrastructure already present)
- **Cons**: 
  - Single point of failure (local server)
  - No distributed SQL benefits
  - Limited scalability
- **Recommendation**: ✅ **RECOMMENDED** unless TiDB Cloud-specific features are required

### Option B: Migrate to TiDB Cloud
- **Pros**: 
  - Distributed SQL, high availability
  - Cloud-native deployment
  - Horizontal scalability
  - TiDB Cloud managed service
- **Cons**: 
  - 8+ working days effort
  - High risk of breaking existing functionality
  - Cost of TiDB Cloud service
  - Migration complexity
- **Recommendation**: Only if TiDB-specific features (HTAP, global distribution) are required

### Option C: Hybrid Approach
- Keep local MariaDB for primary operations
- Use TiDB Cloud for analytics/reporting
- **Pros**: Low risk, incremental adoption
- **Cons**: Dual database management, data sync complexity
- **Recommendation**: Good for gradual migration

## Conclusion & Recommendation

**Current Recommendation: Stay with Local MariaDB**

Rationale:
1. ✅ Application is 100% working with local database
2. ✅ All 18 sidebar modules displaying real data from database
3. ✅ Build .deb and Windows executables completed successfully
4. ✅ Code quality checks pass (tsc, go vet, go build)
5. ✅ Database seed (roles, admin, lokasi) already created
6. ✅ Application running at `/usr/bin/SIMARC`
7. ⚠️ TiDB migration carries high risk of breaking existing functionality
8. ⚠️ 8+ working days is significant effort with no guaranteed benefit
9. ⚠️ TiDB Cloud host `gateway01.ap-northeast-1.prod.aws.tidibcloud.com:4000` not directly accessible from current environment

**If TiDB Cloud is required:**
- Start with Phase 1-2 (preparation + schema test) on a TiDB Cloud free tier
- Validate all functionality before full cutover
- Maintain local MariaDB as fallback during and after migration
- Document all changes and have rollback plan ready

**Next Steps if Proceeding with Migration:**
1. Test TiDB Cloud connectivity from development environment
2. Create TiDB Cloud database `simarc` via web console
3. Import `simarc.sql` and validate
4. Run application with TiDB connection string
5. Test all 18 modules thoroughly
6. If critical issues, revert to local and reconsider

## Backup Status
- **Local database backup**: `simarc.sql` (complete, includes structure + data + seed)
- **Ready for import**: Yes, phpMyAdmin format compatible with TiDB
- **Last updated**: 05 Nov 2026 07:10 (from SQL dump generation)