
# Fix Onboarding Wizard Navigation and Data Persistence

## Problem Analysis

### Issue 1: Continue Button Not Responding

After investigating the code, I found that the Continue button in the organization list should work correctly since the `TableRow` doesn't have a click handler. However, there may be an issue with the button being obscured or the navigation not working properly.

Looking at `ClientOrganizationManager.tsx` lines 761-770:
```typescript
{effectiveStatus === 'in_progress' && (
  <V3Button
    size="sm"
    variant="outline"
    className="gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
    onClick={() => navigate(`/admin?tab=onboarding-wizard&org=${org.id}`)}
  >
    <PlayCircle className="h-3 w-3" />
    Continue
  </V3Button>
)}
```

The button has `opacity-0` by default and only shows on hover. Additionally, it's positioned inside a flex container alongside the `OnboardingStatusBadge`, which might cause layout issues.

### Issue 2: Going Back Erases Data

This is a confirmed bug. The `handleBack` function in `OnboardingWizardRedesign.tsx` simply changes the step without saving current data:

```typescript
const handleBack = () => {
  if (currentStep > 1) {
    goToStep((currentStep - 1) as WizardStep);
  }
};
```

And `goToStep` only updates the `currentStep` state - it does NOT persist unsaved form data.

Each step component maintains its own local state (e.g., `Step4Integrations` has `integrations` state). When you navigate away, this local state is destroyed. When you return, the component reinitializes from `stepData` which contains the last SAVED state, not your unsaved changes.

---

## Solution Overview

```text
+------------------------------------------+
|  BEFORE: Data Loss on Back Navigation    |
+------------------------------------------+
|  Step 3 (local state: {invited: 5})      |
|           |                              |
|      [Back Button]                       |
|           |                              |
|      goToStep(2) <- no save!             |
|           |                              |
|  Step 2 renders                          |
|           |                              |
|      [Next Button]                       |
|           |                              |
|  Step 3 reinitializes from stepData      |
|  (local state: {invited: 0}) <- LOST!    |
+------------------------------------------+

+------------------------------------------+
|  AFTER: Data Preserved                   |
+------------------------------------------+
|  Step 3 (local state: {invited: 5})      |
|           |                              |
|      [Back Button]                       |
|           |                              |
|      saveCurrentStepData() <- NEW!       |
|           |                              |
|      goToStep(2)                         |
|           |                              |
|  Step 2 renders                          |
|           |                              |
|      [Next Button]                       |
|           |                              |
|  Step 3 reinitializes from stepData      |
|  (local state: {invited: 5}) <- SAVED!   |
+------------------------------------------+
```

---

## Implementation Plan

### Phase 1: Fix Data Persistence on Back Navigation

**1.1 Update `OnboardingWizardRedesign.tsx`**

Add state tracking for each step's current (unsaved) data:

```typescript
// Add state to track current step's unsaved data
const [currentStepData, setCurrentStepData] = useState<Record<string, unknown>>({});

// Handler for steps to report their data changes
const handleStepDataChange = useCallback((data: Record<string, unknown>) => {
  setCurrentStepData(data);
}, []);

// Enhanced back handler that saves before navigating
const handleBack = async () => {
  if (currentStep > 1) {
    // Save current step's data before navigating
    if (Object.keys(currentStepData).length > 0) {
      await updateStepData(currentStep, currentStepData);
    }
    goToStep((currentStep - 1) as WizardStep);
    setCurrentStepData({}); // Reset for new step
  }
};
```

**1.2 Update Step Components to Report Changes**

Each step component needs to call `onDataChange` when form values change:

| Component | Changes Needed |
|-----------|----------------|
| `Step2OrgProfile.tsx` | Add `onDataChange` prop, call on form changes |
| `Step3Users.tsx` | Add `onDataChange` prop, call when users are added/removed |
| `Step4Integrations.tsx` | Add `onDataChange` prop, call when integration state changes |
| `Step5Watchlists.tsx` | Add `onDataChange` prop, call when watchlists change |

**1.3 Wire Up `onDataChange` in Parent**

Pass the `handleStepDataChange` callback to each step:

```typescript
{currentStep === 4 && organizationId && (
  <Step4Integrations 
    organizationId={organizationId} 
    stepData={stepData.step4 as Record<string, unknown> || {}} 
    onComplete={handleStepComplete} 
    onBack={handleBack}
    onDataChange={handleStepDataChange}  // NEW
  />
)}
```

---

### Phase 2: Fix Continue Button Visibility and Click

**2.1 Improve Button Layout**

Move the Continue/Start buttons outside the flex container or ensure they're not being clipped:

```typescript
<TableCell>
  <div className="flex items-center gap-2">
    <OnboardingStatusBadge ... />
  </div>
  {/* Move button to separate div for better click targeting */}
  {effectiveStatus === 'in_progress' && (
    <V3Button
      size="sm"
      variant="outline"
      className="gap-1 mt-1"  // Always visible, below badge
      onClick={(e) => {
        e.stopPropagation();
        navigate(`/admin?tab=onboarding-wizard&org=${org.id}`);
      }}
    >
      <PlayCircle className="h-3 w-3" />
      Continue
    </V3Button>
  )}
</TableCell>
```

**2.2 Add Event Propagation Stop**

Add `e.stopPropagation()` to all action buttons to prevent any parent handlers from intercepting:

```typescript
onClick={(e) => {
  e.stopPropagation();
  navigate(`/admin?tab=onboarding-wizard&org=${org.id}`);
}}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/admin/onboarding/OnboardingWizardRedesign.tsx` | Add `currentStepData` state, update `handleBack` to save data, pass `onDataChange` to steps |
| `src/components/admin/onboarding/steps/Step2OrgProfile.tsx` | Add `onDataChange` prop and call it on form changes |
| `src/components/admin/onboarding/steps/Step3Users.tsx` | Add `onDataChange` prop and call it on user list changes |
| `src/components/admin/onboarding/steps/Step4Integrations.tsx` | Add `onDataChange` prop and call it on integration config changes |
| `src/components/admin/onboarding/steps/Step5Watchlists.tsx` | Add `onDataChange` prop and call it on watchlist changes |
| `src/components/admin/ClientOrganizationManager.tsx` | Add `e.stopPropagation()` to Start/Continue/Resolve buttons, improve button visibility |

---

## Technical Details

### Updated Step Component Interface

```typescript
interface StepProps {
  organizationId: string;
  stepData: Record<string, unknown>;
  onComplete: (step: WizardStep, data: Record<string, unknown>) => Promise<void>;
  onBack: () => void;
  onDataChange?: (data: Record<string, unknown>) => void;  // NEW
}
```

### Example: Step4Integrations with onDataChange

```typescript
// Add effect to report changes when integrations state changes
useEffect(() => {
  onDataChange?.({ integrations });
}, [integrations, onDataChange]);
```

### Enhanced handleBack

```typescript
const handleBack = async () => {
  if (currentStep > 1) {
    // Save current step data to database (non-blocking)
    if (Object.keys(currentStepData).length > 0) {
      try {
        await updateStepData(currentStep, currentStepData);
      } catch (err) {
        console.warn('Failed to save step data before navigation:', err);
        // Continue with navigation anyway
      }
    }
    goToStep((currentStep - 1) as WizardStep);
    setCurrentStepData({});
  }
};
```

---

## Testing Checklist

After implementation, verify:

1. **Continue Button Works**
   - Hover over MPAC row in org list
   - Continue button appears and is clickable
   - Clicking navigates to wizard at correct step

2. **Data Persists on Back**
   - Go to Step 4 (Integrations)
   - Configure an integration (test connection)
   - Click Back to go to Step 3
   - Click Next to return to Step 4
   - Verify integration config is still there

3. **Progress Saved Correctly**
   - Make changes in any step
   - Click Back multiple times
   - Refresh the page
   - Resume wizard - previous data should be restored

---

## Expected Outcome

After these changes:

1. **Continue button** will reliably open the wizard at the correct step
2. **Back navigation** will save any unsaved changes before navigating
3. **Form data** will persist across step navigation without requiring the user to complete the step
4. **User experience** will be smooth with no data loss during multi-step onboarding
