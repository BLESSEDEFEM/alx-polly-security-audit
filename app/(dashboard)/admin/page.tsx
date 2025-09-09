"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { adminDeletePoll } from "@/app/lib/actions/poll-actions";
import { isUserAdmin } from "@/app/lib/actions/auth-actions";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/app/lib/context/auth-context";

/**
 * Admin Dashboard Page Component
 * 
 * Provides administrative interface for managing all polls in the system.
 * Only accessible to users with admin privileges. Displays comprehensive
 * poll information including owner details and provides bulk management capabilities.
 * 
 * Security Features:
 * - Admin privilege verification before rendering
 * - Secure poll deletion with confirmation
 * - Access control enforcement
 * 
 * Features:
 * - View all polls across the platform
 * - Delete any poll with admin privileges
 * - Display poll metadata (ID, owner, creation date)
 * - Real-time poll data fetching
 * - Loading states and error handling
 * 
 * @returns {JSX.Element} Admin panel interface or access denied message
 */

interface Poll {
  id: string;
  question: string;
  user_id: string;
  created_at: string;
  options: string[];
}

export default function AdminPage() {
  // State management for admin panel data and UI states
  const [polls, setPolls] = useState<Poll[]>([]); // All polls in the system
  const [loading, setLoading] = useState(true); // Loading state for poll data
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false); // Admin privilege verification status
  const [authLoading, setAuthLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();

  // Redirect non-authenticated users and verify admin status
  useEffect(() => {
    checkAdminAccess();
  }, [user]);

  useEffect(() => {
    if (isAdmin) {
      fetchAllPolls(); // Load all polls only for verified admins
    }
  }, [isAdmin]);

  /**
   * Verifies if the current user has admin privileges
   * Only loads poll data if admin status is confirmed
   */
  const checkAdminAccess = async () => {
    if (!user) {
      router.push('/login');
      return;
    }

    const adminStatus = await isUserAdmin();
    if (!adminStatus) {
      router.push('/polls'); // Redirect non-admin users
      return;
    }

    setIsAdmin(true);
    setAuthLoading(false);
  };

  /**
   * Fetches all polls from the database for admin review
   * Ordered by creation date (newest first) for better management
   */
  const fetchAllPolls = async () => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("polls")
      .select("*")
      .order("created_at", { ascending: false }); // Show newest polls first

    if (!error && data) {
      setPolls(data);
    }
    setLoading(false);
  };

  /**
   * Handles poll deletion with admin privileges
   * Includes confirmation dialog to prevent accidental deletions
   * @param {string} pollId - The ID of the poll to delete
   */
  const handleDelete = async (pollId: string) => {
    // Confirmation dialog to prevent accidental deletions
    if (!confirm('Are you sure you want to delete this poll? This action cannot be undone.')) {
      return;
    }
    
    setDeleteLoading(pollId);
    const result = await adminDeletePoll(pollId); // Use admin-privileged deletion

    if (!result.error) {
      // Update local state to reflect deletion immediately
      setPolls(polls.filter((poll) => poll.id !== pollId));
    } else {
      alert(`Error deleting poll: ${result.error}`);
    }

    setDeleteLoading(null);
  };

  if (authLoading) {
    return <div className="p-6">Checking admin access...</div>;
  }

  if (!isAdmin) {
    return <div className="p-6">Access denied. Admin privileges required.</div>;
  }

  if (loading) {
    return <div className="p-6">Loading all polls...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Admin Panel</h1>
        <p className="text-gray-600 mt-2">
          View and manage all polls in the system.
        </p>
      </div>

      <div className="grid gap-4">
        {polls.map((poll) => (
          <Card key={poll.id} className="border-l-4 border-l-blue-500">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{poll.question}</CardTitle>
                  <CardDescription>
                    <div className="space-y-1 mt-2">
                      <div>
                        Poll ID:{" "}
                        <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                          {poll.id}
                        </code>
                      </div>
                      <div>
                        Owner ID:{" "}
                        <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                          {poll.user_id}
                        </code>
                      </div>
                      <div>
                        Created:{" "}
                        {new Date(poll.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </CardDescription>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(poll.id)}
                  disabled={deleteLoading === poll.id}
                >
                  {deleteLoading === poll.id ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <h4 className="font-medium">Options:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {poll.options.map((option, index) => (
                    <li key={index} className="text-gray-700">
                      {option}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {polls.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No polls found in the system.
        </div>
      )}
    </div>
  );
}
