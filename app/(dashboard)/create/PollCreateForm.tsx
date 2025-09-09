"use client";

import { useState } from "react";
import { createPoll } from "@/app/lib/actions/poll-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * PollCreateForm - Interactive form component for creating new polls
 * 
 * This component provides a user-friendly interface for poll creation with:
 * - Dynamic option management (add/remove with minimum 2 options)
 * - Real-time form validation and error handling
 * - Success feedback with automatic redirection
 * - Integration with server actions for secure poll creation
 * 
 * Features:
 * - Minimum 2 options enforced for valid polls
 * - Dynamic option addition/removal with intuitive UI
 * - Form submission with loading states and error handling
 * - Automatic redirect to polls list after successful creation
 * - Client-side state management for responsive user experience
 * 
 * @returns {JSX.Element} Poll creation form with dynamic options
 */
export default function PollCreateForm() {
  // Form state management
  const [options, setOptions] = useState(["", ""]); // Start with 2 empty options (minimum required)
  const [error, setError] = useState<string | null>(null); // Error message display
  const [success, setSuccess] = useState(false); // Success state for user feedback

  /**
   * Updates a specific option value at the given index
   * @param {number} idx - Index of the option to update
   * @param {string} value - New value for the option
   */
  const handleOptionChange = (idx: number, value: string) => {
    setOptions((opts) => opts.map((opt, i) => (i === idx ? value : opt)));
  };

  /** Adds a new empty option to the poll */
  const addOption = () => setOptions((opts) => [...opts, ""]);
  
  /**
   * Removes an option at the specified index
   * Enforces minimum of 2 options for valid polls
   * @param {number} idx - Index of the option to remove
   */
  const removeOption = (idx: number) => {
    if (options.length > 2) {
      setOptions((opts) => opts.filter((_, i) => i !== idx));
    }
  };

  return (
    <form
      action={async (formData) => {
        // Reset form state before submission
        setError(null);
        setSuccess(false);
        
        // Submit poll creation request to server action
        const res = await createPoll(formData);
        
        // Handle response and provide user feedback
        if (res?.error) {
          setError(res.error); // Display validation or server errors
        } else {
          setSuccess(true); // Show success message
          // Redirect to polls list after brief success display
          setTimeout(() => {
            window.location.href = "/polls";
          }, 1200);
        }
      }}
      className="space-y-6 max-w-md mx-auto"
    >
      <div>
        <Label htmlFor="question">Poll Question</Label>
        <Input name="question" id="question" required />
      </div>
      <div>
        <Label>Options</Label>
        {options.map((opt, idx) => (
          <div key={idx} className="flex items-center gap-2 mb-2">
            <Input
              name="options"
              value={opt}
              onChange={(e) => handleOptionChange(idx, e.target.value)}
              required
            />
            {options.length > 2 && (
              <Button type="button" variant="destructive" onClick={() => removeOption(idx)}>
                Remove
              </Button>
            )}
          </div>
        ))}
        <Button type="button" onClick={addOption} variant="secondary">
          Add Option
        </Button>
      </div>
      {error && <div className="text-red-500">{error}</div>}
      {success && <div className="text-green-600">Poll created! Redirecting...</div>}
      <Button type="submit">Create Poll</Button>
    </form>
  );
}