'use client';

import { useState } from 'react';
import { updatePoll } from '@/app/lib/actions/poll-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * EditPollForm - Component for editing existing polls
 * 
 * This component allows poll owners to modify their existing polls with:
 * - Pre-populated form fields with current poll data
 * - Dynamic option management (add/remove with minimum 2 options)
 * - Real-time validation and error handling
 * - Success feedback with automatic redirection
 * - Integration with server actions for secure poll updates
 * 
 * Features:
 * - Loads existing poll data into editable form
 * - Maintains minimum 2 options requirement
 * - Handles form submission with proper error states
 * - Automatic redirect after successful update
 * - Client-side state management for responsive editing
 * 
 * Security:
 * - Server-side ownership validation in updatePoll action
 * - Input sanitization handled by server action
 * - Authentication required for poll modifications
 * 
 * @param {Object} props - Component props
 * @param {any} props.poll - Poll object containing current poll data
 * @returns {JSX.Element} Poll editing form with pre-populated data
 */
export default function EditPollForm({ poll }: { poll: any }) {
  // Form state initialized with existing poll data
  const [question, setQuestion] = useState(poll.question); // Pre-populate with current question
  const [options, setOptions] = useState<string[]>(poll.options || []); // Pre-populate with current options
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
  const addOption = () => setOptions((opts) => [...opts, '']);
  
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
        
        // Prepare form data with current state values
        formData.set('question', question);
        formData.delete('options'); // Clear existing options
        options.forEach((opt) => formData.append('options', opt)); // Add current options
        
        // Submit poll update request to server action
        const res = await updatePoll(poll.id, formData);
        
        // Handle response and provide user feedback
        if (res?.error) {
          setError(res.error); // Display validation or server errors
        } else {
          setSuccess(true); // Show success message
          // Redirect to polls list after brief success display
          setTimeout(() => {
            window.location.href = '/polls';
          }, 1200);
        }
      }}
      className="space-y-6"
    >
      <div>
        <Label htmlFor="question">Poll Question</Label>
        <Input
          name="question"
          id="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          required
        />
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
      {success && <div className="text-green-600">Poll updated! Redirecting...</div>}
      <Button type="submit">Update Poll</Button>
    </form>
  );
}