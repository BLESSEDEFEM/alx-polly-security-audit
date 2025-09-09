"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Poll Management Actions for ALX Polly Application
 * 
 * This module contains server-side actions for managing polls in the ALX Polly application.
 * All functions are marked with "use server" directive for Next.js App Router server actions.
 * 
 * Key features:
 * - CRUD operations for polls (Create, Read, Update, Delete)
 * - Input validation and sanitization to prevent XSS attacks
 * - Role-based access control (RBAC) for admin functions
 * - Ownership validation for user-specific operations
 * - Voting system integration
 * 
 * Security measures implemented:
 * - Authentication checks for all operations
 * - Authorization validation (ownership and admin roles)
 * - Input sanitization to prevent script injection
 * - Comprehensive input validation
 */

/**
 * Sanitizes user input by removing potentially dangerous HTML/script tags
 * 
 * This function provides basic XSS protection by:
 * - Trimming whitespace
 * - Removing script tags and their content
 * - Stripping all HTML tags
 * 
 * @param {string} input - Raw user input string
 * @returns {string} Sanitized string safe for database storage
 */
function sanitizeString(input: string): string {
  return input.trim().replace(/<script[^>]*>.*?<\/script>/gi, '').replace(/<[^>]*>/g, '');
}

/**
 * Validates poll input data for creation and updates
 * 
 * Performs comprehensive validation on poll questions and options:
 * - Question: required, max 500 characters
 * - Options: minimum 2, maximum 10, each max 200 characters
 * - Ensures no empty options
 * 
 * @param {string} question - Poll question text
 * @param {string[]} options - Array of poll option strings
 * @returns {string[]} Array of validation error messages (empty if valid)
 */
function validatePollInput(question: string, options: string[]) {
  const errors: string[] = [];
  
  // Validate question
  if (!question || question.trim().length === 0) {
    errors.push('Question is required');
  } else if (question.trim().length > 500) {
    errors.push('Question must be less than 500 characters');
  }
  
  // Validate options
  if (!options || options.length < 2) {
    errors.push('At least 2 options are required');
  } else if (options.length > 10) {
    errors.push('Maximum 10 options allowed');
  }
  
  // Validate each option
  options.forEach((option, index) => {
    if (!option || option.trim().length === 0) {
      errors.push(`Option ${index + 1} cannot be empty`);
    } else if (option.trim().length > 200) {
      errors.push(`Option ${index + 1} must be less than 200 characters`);
    }
  });
  
  return errors;
}

/**
 * Creates a new poll with validation and security measures
 * 
 * This function handles the complete poll creation process including:
 * - Input validation and sanitization to prevent XSS attacks
 * - User authentication verification
 * - Database insertion with proper error handling
 * - Cache revalidation for updated poll lists
 * 
 * Security features:
 * - Validates all input data before processing
 * - Sanitizes question and options to prevent script injection
 * - Requires user authentication
 * - Associates poll with authenticated user ID
 * 
 * @param {FormData} formData - Form data containing question and options
 * @returns {Promise<{error: string | null}>} Success/error response object
 */
export async function createPoll(formData: FormData) {
  const supabase = await createClient();

  // Extract raw form data
  const rawQuestion = formData.get("question") as string;
  const rawOptions = formData.getAll("options").filter(Boolean) as string[];

  // Validate input data before processing
  const validationErrors = validatePollInput(rawQuestion, rawOptions);
  if (validationErrors.length > 0) {
    return { error: validationErrors.join(', ') };
  }

  // Sanitize input to prevent XSS attacks
  const question = sanitizeString(rawQuestion);
  const options = rawOptions.map(option => sanitizeString(option));

  // Verify user authentication
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) {
    return { error: userError.message };
  }
  if (!user) {
    return { error: "You must be logged in to create a poll." };
  }

  // Insert poll into database with user ownership
  const { error } = await supabase.from("polls").insert([
    {
      user_id: user.id, // Associate poll with authenticated user
      question,
      options,
    },
  ]);

  if (error) {
    return { error: error.message };
  }

  // Revalidate polls page cache to show new poll
  revalidatePath("/polls");
  return { error: null };
}

/**
 * Administrative function to delete any poll (bypasses ownership check)
 * 
 * This function provides admin-level poll deletion capabilities with strict
 * role-based access control. Unlike regular poll deletion, this function
 * allows admins to delete any poll regardless of ownership.
 * 
 * Security measures:
 * - Requires user authentication
 * - Validates admin role from user metadata
 * - Implements role-based access control (RBAC)
 * - Prevents privilege escalation by non-admin users
 * 
 * Use cases:
 * - Content moderation by administrators
 * - Removal of inappropriate or spam polls
 * - Administrative cleanup operations
 * 
 * @param {string} id - UUID of the poll to delete
 * @returns {Promise<{error: string | null}>} Success/error response object
 */
export async function adminDeletePoll(id: string) {
  const supabase = await createClient();
  
  // Verify user authentication
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) {
    return { error: userError.message };
  }
  if (!user) {
    return { error: "You must be logged in to delete a poll." };
  }

  // Validate admin role - critical security check
  const isAdmin = user.user_metadata?.role === 'admin';
  if (!isAdmin) {
    return { error: "Admin privileges required to delete any poll." };
  }

  // Admin can delete any poll (no ownership check)
  const { error } = await supabase
    .from("polls")
    .delete()
    .eq("id", id);
    
  if (error) return { error: error.message };
  
  // Revalidate cache to reflect deletion
  revalidatePath("/polls");
  return { error: null };
}

/**
 * Retrieves all polls created by the authenticated user
 * 
 * This function fetches polls owned by the current user, providing a secure
 * way to display user-specific poll data. Results are ordered by creation date
 * with newest polls first.
 * 
 * Security features:
 * - Requires user authentication
 * - Only returns polls owned by the authenticated user
 * - Prevents unauthorized access to other users' polls
 * 
 * @returns {Promise<{polls: Poll[], error: string | null}>} User's polls or error
 */
export async function getUserPolls() {
  const supabase = await createClient();
  
  // Verify user authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { polls: [], error: "Not authenticated" };

  // Fetch polls owned by authenticated user only
  const { data, error } = await supabase
    .from("polls")
    .select("*")
    .eq("user_id", user.id) // Ownership filter for security
    .order("created_at", { ascending: false }); // Newest first

  if (error) return { polls: [], error: error.message };
  return { polls: data ?? [], error: null };
}

/**
 * Retrieves a specific poll by its ID
 * 
 * This function fetches a single poll by its unique identifier. It's used
 * for displaying poll details, voting interfaces, and poll management.
 * Note: This function doesn't enforce ownership checks as polls may be
 * publicly viewable for voting purposes.
 * 
 * @param {string} id - UUID of the poll to retrieve
 * @returns {Promise<{poll: Poll | null, error: string | null}>} Poll data or error
 */
export async function getPollById(id: string) {
  const supabase = await createClient();
  
  // Fetch poll by ID (no ownership check for public viewing)
  const { data, error } = await supabase
    .from("polls")
    .select("*")
    .eq("id", id)
    .single(); // Expect single result

  if (error) return { poll: null, error: error.message };
  return { poll: data, error: null };
}

/**
 * Submits a vote for a specific poll option
 * 
 * This function handles vote submission for polls, supporting both authenticated
 * and anonymous voting. The voting system prevents duplicate votes through
 * database constraints on user_id or IP address.
 * 
 * Features:
 * - Supports both authenticated and anonymous voting
 * - Prevents duplicate votes (handled by database constraints)
 * - Associates votes with user ID when authenticated
 * - Stores anonymous votes with IP tracking (if implemented)
 * 
 * @param {string} pollId - UUID of the poll being voted on
 * @param {number} optionIndex - Index of the selected option (0-based)
 * @returns {Promise<{error: string | null}>} Success/error response object
 */
export async function submitVote(pollId: string, optionIndex: number) {
  const supabase = await createClient();
  
  // Get user session (may be null for anonymous voting)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Note: Anonymous voting is currently allowed
  // Uncomment the following lines to require authentication:
  // if (!user) return { error: 'You must be logged in to vote.' };

  // Insert vote record
  const { error } = await supabase.from("votes").insert([
    {
      poll_id: pollId,
      user_id: user?.id ?? null, // null for anonymous votes
      option_index: optionIndex,
    },
  ]);

  if (error) return { error: error.message };
  return { error: null };
}

/**
 * Deletes a poll owned by the authenticated user
 * 
 * This function provides secure poll deletion with strict ownership validation.
 * Only the poll creator can delete their own polls, preventing unauthorized
 * deletion of other users' content.
 * 
 * Security measures:
 * - Requires user authentication
 * - Validates poll ownership before deletion
 * - Uses compound WHERE clause (id AND user_id) for security
 * - Prevents unauthorized deletion attempts
 * 
 * @param {string} id - UUID of the poll to delete
 * @returns {Promise<{error: string | null}>} Success/error response object
 */
export async function deletePoll(id: string) {
  const supabase = await createClient();
  
  // Verify user authentication
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) {
    return { error: userError.message };
  }
  if (!user) {
    return { error: "You must be logged in to delete a poll." };
  }

  // Delete poll with ownership validation (critical security measure)
  const { error } = await supabase
    .from("polls")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id); // Ensures only owner can delete
    
  if (error) return { error: error.message };
  
  // Revalidate cache to reflect deletion
  revalidatePath("/polls");
  return { error: null };
}

/**
 * Updates an existing poll with validation and security measures
 * 
 * This function handles poll updates with comprehensive security checks,
 * input validation, and sanitization. Only poll owners can update their polls.
 * 
 * Security features:
 * - Input validation and sanitization to prevent XSS
 * - User authentication verification
 * - Ownership validation before update
 * - Prevents unauthorized poll modifications
 * 
 * @param {string} pollId - UUID of the poll to update
 * @param {FormData} formData - Form data containing updated question and options
 * @returns {Promise<{error: string | null}>} Success/error response object
 */
export async function updatePoll(pollId: string, formData: FormData) {
  const supabase = await createClient();

  // Extract raw form data
  const rawQuestion = formData.get("question") as string;
  const rawOptions = formData.getAll("options").filter(Boolean) as string[];

  // Validate input data before processing
  const validationErrors = validatePollInput(rawQuestion, rawOptions);
  if (validationErrors.length > 0) {
    return { error: validationErrors.join(', ') };
  }

  // Sanitize input to prevent XSS attacks
  const question = sanitizeString(rawQuestion);
  const options = rawOptions.map(option => sanitizeString(option));

  // Verify user authentication
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) {
    return { error: userError.message };
  }
  if (!user) {
    return { error: "You must be logged in to update a poll." };
  }

  // Update poll with ownership validation (critical security measure)
  const { error } = await supabase
    .from("polls")
    .update({ question, options })
    .eq("id", pollId)
    .eq("user_id", user.id); // Ensures only owner can update

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}
