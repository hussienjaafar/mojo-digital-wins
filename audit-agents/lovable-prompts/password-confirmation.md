# Lovable Prompt: Add Password Confirmation Server-Side Validation

## Task
Update the `accept-invitation-signup` edge function to validate password confirmation on the server side.

## Requirements

1. **Update the request body schema** to include `confirm_password` field:
   ```typescript
   interface SignupRequest {
     token: string;
     email: string;
     password: string;
     confirm_password: string;
     full_name: string;
   }
   ```

2. **Add validation at the beginning of the function** (after parsing the request body):
   ```typescript
   // Validate password confirmation
   if (password !== confirm_password) {
     return new Response(
       JSON.stringify({
         error: "Passwords do not match",
         code: "PASSWORD_MISMATCH"
       }),
       {
         status: 400,
         headers: { ...corsHeaders, "Content-Type": "application/json" }
       }
     );
   }
   ```

3. **Validation should occur before**:
   - Password strength validation
   - Token validation
   - User creation

4. **Return appropriate error response**:
   - HTTP Status: 400 (Bad Request)
   - Error code: `PASSWORD_MISMATCH`
   - Error message: "Passwords do not match"

## Implementation Notes

- This is a security best practice to ensure the user entered their intended password
- The client already validates this, but server-side validation provides defense in depth
- The `confirm_password` field should NOT be stored or logged anywhere
- Update any existing tests to include the `confirm_password` field in test requests

## File Location
`supabase/functions/accept-invitation-signup/index.ts`
