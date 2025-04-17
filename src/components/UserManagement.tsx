
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Loader2, Trash, Ban, Clock } from "lucide-react";
import { Database } from "@/integrations/supabase/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type UserRole = Database["public"]["Enums"]["app_role"];

type User = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  last_sign_in_at: string | null;
  is_blocked?: boolean;
};

export const UserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [blockingUserId, setBlockingUserId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      
      console.log("Attempting to fetch users...");
      
      // First try using the RPC function
      let { data, error } = await supabase.rpc("get_all_users_with_profiles");

      // If that fails, fall back to direct query
      if (error) {
        console.error("Error with RPC method:", error);
        console.log("Falling back to direct query...");
        
        // Fallback: Query profiles directly
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });
          
        if (profilesError) {
          console.error("Error with fallback query:", profilesError);
          setFetchError(`Failed to load users: ${profilesError.message}`);
          toast({
            title: "Error",
            description: `Failed to load users: ${profilesError.message}`,
            variant: "destructive",
          });
          throw profilesError;
        }
        
        if (profilesData) {
          console.log("Retrieved profiles via direct query:", profilesData);
          
          // Map the profiles data to match our User type
          data = profilesData.map(profile => ({
            id: profile.id,
            email: profile.email,
            full_name: profile.full_name,
            role: profile.role as UserRole,
            created_at: profile.created_at,
            last_sign_in_at: null // We don't have this from profiles table
          }));
        }
      } else {
        console.log("Successfully retrieved users via RPC:", data);
      }
      
      if (!data || data.length === 0) {
        console.log("No users found in the database");
        setUsers([]);
        return;
      }

      // Convert role to proper type and set users
      const typedUsers = data.map(user => ({
        ...user,
        role: user.role as UserRole,
        is_blocked: user.is_blocked || false
      }));
      
      setUsers(typedUsers);
      setFetchError(null);
    } catch (error) {
      console.error("Error in fetchUsers:", error);
      setFetchError("Failed to load users. Please try again later.");
      toast({
        title: "Error",
        description: "Failed to load users. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      setUpdatingUserId(userId);
      
      console.log(`Updating user ${userId} to role ${newRole}`);
      
      // First try the RPC method
      const { data, error } = await supabase.rpc("update_user_role", {
        user_id: userId,
        new_role: newRole
      });

      if (error) {
        console.error("Error using RPC to update user role:", error);
        
        // Fallback: Update directly
        console.log("Falling back to direct update...");
        const { data: updateData, error: updateError } = await supabase
          .from('profiles')
          .update({ role: newRole })
          .eq('id', userId);
          
        if (updateError) {
          console.error("Error with direct update:", updateError);
          toast({
            title: "Error",
            description: `Failed to update user role: ${updateError.message}`,
            variant: "destructive",
          });
          throw updateError;
        }
        
        // Update local state on successful direct update
        setUsers(users.map(user => 
          user.id === userId ? { ...user, role: newRole } : user
        ));
        
        toast({
          title: "Success",
          description: "User role updated successfully",
        });
        return;
      }
      
      console.log("Update role response:", data);
      
      if (data) {
        // Update local state on successful RPC update
        setUsers(users.map(user => 
          user.id === userId ? { ...user, role: newRole } : user
        ));
        
        toast({
          title: "Success",
          description: "User role updated successfully",
        });
      } else {
        throw new Error("Failed to update user role");
      }
    } catch (error) {
      console.error("Error in handleRoleChange:", error);
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive",
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      setDeletingUserId(userId);
      
      console.log(`Deleting user ${userId}`);
      
      // Delete user using the auth.users table
      const { error } = await supabase.rpc("delete_user", {
        user_id: userId
      });
      
      if (error) {
        console.error("Error deleting user:", error);
        toast({
          title: "Error",
          description: `Failed to delete user: ${error.message}`,
          variant: "destructive",
        });
        throw error;
      }
      
      // Update local state
      setUsers(users.filter(user => user.id !== userId));
      
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
    } catch (error) {
      console.error("Error in handleDeleteUser:", error);
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      });
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleBlockUser = async (userId: string, isBlocked: boolean) => {
    try {
      setBlockingUserId(userId);
      
      console.log(`${isBlocked ? 'Blocking' : 'Unblocking'} user ${userId}`);
      
      // Update user blocked status using RPC
      const { error } = await supabase.rpc("toggle_user_block_status", {
        user_id: userId,
        is_blocked: isBlocked
      });
      
      if (error) {
        console.error("Error updating user block status:", error);
        toast({
          title: "Error",
          description: `Failed to ${isBlocked ? 'block' : 'unblock'} user: ${error.message}`,
          variant: "destructive",
        });
        throw error;
      }
      
      // Update local state
      setUsers(users.map(user => 
        user.id === userId ? { ...user, is_blocked: isBlocked } : user
      ));
      
      toast({
        title: "Success",
        description: `User ${isBlocked ? 'blocked' : 'unblocked'} successfully`,
      });
    } catch (error) {
      console.error("Error in handleBlockUser:", error);
      toast({
        title: "Error",
        description: `Failed to ${isBlocked ? 'block' : 'unblock'} user`,
        variant: "destructive",
      });
    } finally {
      setBlockingUserId(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString() + " " + 
           new Date(dateString).toLocaleTimeString();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">User Management</h2>
          <Button onClick={fetchUsers} variant="outline" size="sm">
            Retry
          </Button>
        </div>
        
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{fetchError}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">User Management</h2>
        <Button onClick={fetchUsers} variant="outline" size="sm">
          Refresh
        </Button>
      </div>
      
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Last Sign In</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-6">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id} className={user.is_blocked ? "bg-gray-100" : ""}>
                  <TableCell>{user.full_name || "N/A"}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.role === "admin" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
                    }`}>
                      {user.role}
                    </span>
                  </TableCell>
                  <TableCell>{formatDate(user.created_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-gray-500" />
                      {formatDate(user.last_sign_in_at)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.is_blocked 
                        ? "bg-red-100 text-red-800" 
                        : "bg-green-100 text-green-800"
                    }`}>
                      {user.is_blocked ? "Blocked" : "Active"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end items-center space-x-2">
                      <Select
                        value={user.role}
                        onValueChange={(value: string) => {
                          // Ensure value is a valid role
                          const roleValue = value as UserRole;
                          handleRoleChange(user.id, roleValue);
                        }}
                        disabled={updatingUserId === user.id}
                      >
                        <SelectTrigger className="w-[100px]">
                          {updatingUserId === user.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <SelectValue />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="user">User</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className={`w-8 h-8 p-0 ${user.is_blocked ? "bg-green-50" : "bg-red-50"}`}
                          >
                            <Ban className={`h-4 w-4 ${user.is_blocked ? "text-green-600" : "text-red-600"}`} />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {user.is_blocked ? "Unblock User" : "Block User"}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {user.is_blocked 
                                ? `Are you sure you want to unblock ${user.email}? They will regain access to the system.`
                                : `Are you sure you want to block ${user.email}? They will lose access to the system.`
                              }
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleBlockUser(user.id, !user.is_blocked)}
                              className={user.is_blocked ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
                            >
                              {blockingUserId === user.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : null}
                              {user.is_blocked ? "Unblock" : "Block"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="w-8 h-8 p-0 bg-red-50"
                          >
                            <Trash className="h-4 w-4 text-red-600" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete User</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete {user.email}? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteUser(user.id)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              {deletingUserId === user.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : null}
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      <p className="text-sm text-gray-500">
        Note: Users with "Admin" role can access the admin dashboard and manage all content.
        Users with "User" role have normal access to the application.
        Blocked users cannot sign in to the application.
      </p>
    </div>
  );
};
