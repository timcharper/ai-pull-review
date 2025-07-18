# Release process

1. Commit all changes as normally
2. Run tests, typecheck

   ```sh
   yarn test
   yarn typecheck
   ```

3. Bump version:

   ```sh
   yarn version
   ```

4. Push everything:

   ```sh
   git push origin main --tags
   ```

5. npm release
