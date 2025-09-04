"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Input validation and sanitization helpers
function sanitizeString(input: string): string {
  return input.trim().replace(/<script[^>]*>.*?<\/script>/gi, '').replace(/<[^>]*>/g, '');
}

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

// CREATE POLL
export async function createPoll(formData: FormData) {
  const supabase = await createClient();

  const rawQuestion = formData.get("question") as string;
  const rawOptions = formData.getAll("options").filter(Boolean) as string[];

  // Validate input
  const validationErrors = validatePollInput(rawQuestion, rawOptions);
  if (validationErrors.length > 0) {
    return { error: validationErrors.join(', ') };
  }

  // Sanitize input
  const question = sanitizeString(rawQuestion);
  const options = rawOptions.map(option => sanitizeString(option));

  // Get user from session
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

  const { error } = await supabase.from("polls").insert([
    {
      user_id: user.id,
      question,
      options,
    },
  ]);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/polls");
  return { error: null };
}

// ADMIN DELETE POLL (bypasses ownership check)
export async function adminDeletePoll(id: string) {
  const supabase = await createClient();
  
  // Get user from session
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

  // Check if user is admin
  const isAdmin = user.user_metadata?.role === 'admin';
  if (!isAdmin) {
    return { error: "Admin privileges required to delete any poll." };
  }

  // Admin can delete any poll
  const { error } = await supabase
    .from("polls")
    .delete()
    .eq("id", id);
    
  if (error) return { error: error.message };
  revalidatePath("/polls");
  return { error: null };
}

// GET USER POLLS
export async function getUserPolls() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { polls: [], error: "Not authenticated" };

  const { data, error } = await supabase
    .from("polls")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return { polls: [], error: error.message };
  return { polls: data ?? [], error: null };
}

// GET POLL BY ID
export async function getPollById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("polls")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return { poll: null, error: error.message };
  return { poll: data, error: null };
}

// SUBMIT VOTE
export async function submitVote(pollId: string, optionIndex: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Optionally require login to vote
  // if (!user) return { error: 'You must be logged in to vote.' };

  const { error } = await supabase.from("votes").insert([
    {
      poll_id: pollId,
      user_id: user?.id ?? null,
      option_index: optionIndex,
    },
  ]);

  if (error) return { error: error.message };
  return { error: null };
}

// DELETE POLL
export async function deletePoll(id: string) {
  const supabase = await createClient();
  
  // Get user from session
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

  // Only allow deleting polls owned by the user
  const { error } = await supabase
    .from("polls")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
    
  if (error) return { error: error.message };
  revalidatePath("/polls");
  return { error: null };
}

// UPDATE POLL
export async function updatePoll(pollId: string, formData: FormData) {
  const supabase = await createClient();

  const rawQuestion = formData.get("question") as string;
  const rawOptions = formData.getAll("options").filter(Boolean) as string[];

  // Validate input
  const validationErrors = validatePollInput(rawQuestion, rawOptions);
  if (validationErrors.length > 0) {
    return { error: validationErrors.join(', ') };
  }

  // Sanitize input
  const question = sanitizeString(rawQuestion);
  const options = rawOptions.map(option => sanitizeString(option));

  // Get user from session
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

  // Only allow updating polls owned by the user
  const { error } = await supabase
    .from("polls")
    .update({ question, options })
    .eq("id", pollId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}
