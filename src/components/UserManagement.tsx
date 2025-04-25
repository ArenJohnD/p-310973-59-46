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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, RefreshCw, UserCog, Shield, ShieldAlert, UserX } from "lucide-react";

type UserRole = Database["public"]["Enums"]["app_role"];

type User = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  last_sign_in_at: string | null;
  profile_last_sign_in_at: string | null;
  is_blocked: boolean;
  is_active: boolean | null;
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
    
    const channel = supabase.channel('user-presence')
      .on('presence', { event: 'sync' }, () => {
        console.log('Presence sync event received, refreshing users');
        fetchUsers(false);
      })
      .subscribe();
    
    const interval = setInterval(() => {
      fetchUsers(false);
    }, 3000);
    
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchUsers = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setFetchError(null);
      
      console.log("Attempting to fetch users...");
      
      let { data, error } = await supabase.rpc("get_all_users_with_profiles");

      if (error) {
        console.error("Error with RPC method:", error);
        console.log("Falling back to direct query...");
        
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
          
          data = profilesData.map(profile => ({
            id: profile.id,
            email: profile.email,
            full_name: profile.full_name,
            role: profile.role as UserRole,
            created_at: profile.created_at,
            last_sign_in_at: null,
            profile_last_sign_in_at: profile.last_sign_in_at,
            is_blocked: false,
            is_active: profile.is_active
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

      const typedUsers = data.map(user => ({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role as UserRole,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        profile_last_sign_in_at: user.profile_last_sign_in_at,
        is_blocked: user.is_blocked,
        is_active: user.is_active
      }));
      
      setUsers(typedUsers);
      setFetchError(null);
    } catch (error) {
      console.error("Error in fetchUsers:", error);
      setFetchError("Failed to load users. Please try again later.");
      if (showLoading) {
        toast({
          title: "Error",
          description: "Failed to load users. Please try again later.",
          variant: "destructive",
        });
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      setUpdatingUserId(userId);
      
      console.log(`Updating user ${userId} to role ${newRole}`);
      
      const { data, error } = await supabase.rpc("update_user_role", {
        user_id: userId,
        new_role: newRole
      });

      if (error) {
        console.error("Error using RPC to update user role:", error);
        
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
      
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);
        
      if (profileError) {
        console.error("Error deleting profile:", profileError);
        console.error("Profile error details:", JSON.stringify(profileError));
      }
      
      const { error } = await supabase.rpc("delete_user", {
        user_id: userId
      });
      
      if (error) {
        console.error("Error deleting user:", error);
        console.error("Error details:", JSON.stringify(error));
        
        if (error.message.includes("foreign key constraint")) {
          const { error: authError } = await supabase.auth.admin.deleteUser(
            userId
          );
          
          if (authError) {
            console.error("Error with direct auth delete:", authError);
            throw new Error(authError.message);
          }
        } else {
          throw new Error(error.message);
        }
      }
      
      setUsers(users.filter(user => user.id !== userId));
      
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
    } catch (error: any) {
      console.error("Error in handleDeleteUser:", error);
      toast({
        title: "Error",
        description: `Failed to delete user: ${error.message || "Unknown error"}`,
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
      
      // Update the local state with the new blocked status
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
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        console.error("Invalid date format:", dateString);
        return "Invalid date";
      }
      
      return date.toLocaleDateString() + " " + date.toLocaleTimeString();
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Date error";
    }
  };

  const getLastSignInTime = (user: User) => {
    if (user.profile_last_sign_in_at) {
      return formatDate(user.profile_last_sign_in_at);
    }
    
    return formatDate(user.last_sign_in_at);
  };

  const handleRefreshClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    fetchUsers(true);
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
          <Button onClick={handleRefreshClick} variant="outline" size="sm">
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
      {/* Header Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <UserCog className="h-5 w-5 text-[rgba(49,159,67,1)]" />
              User Management
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Manage user roles, permissions, and access
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="font-medium">
              {users.length} {users.length === 1 ? 'user' : 'users'}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshClick}
              className="gap-1.5"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {fetchError && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{fetchError}</p>
          </div>
        )}
      </div>

      {/* Users Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-[250px]">User</TableHead>
                <TableHead className="w-[150px] text-center">Role</TableHead>
                <TableHead className="w-[180px]">Last Sign In</TableHead>
                <TableHead className="w-[120px] text-center">Status</TableHead>
                <TableHead className="w-[200px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32">
                    <div className="flex justify-center items-center">
                      <Loader2 className="h-6 w-6 animate-spin text-[rgba(49,159,67,1)]" />
                      <span className="ml-3 text-gray-600">Loading users...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32">
                    <div className="flex flex-col items-center justify-center text-gray-500">
                      <UserX className="h-8 w-8 mb-2 text-gray-400" />
                      <p className="text-sm font-medium">No users found</p>
                      <p className="text-sm text-gray-400">Users will appear here once they sign up</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} className="hover:bg-gray-50/50">
                    <TableCell>
                      <div>
                        <p className="font-medium text-gray-900">{user.full_name || 'Unnamed User'}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Select
                        value={user.role}
                        onValueChange={(value: UserRole) => handleRoleChange(user.id, value)}
                        disabled={updatingUserId === user.id}
                      >
                        <SelectTrigger className="w-[130px] mx-auto">
                          <SelectValue>
                            <div className="flex items-center gap-2">
                              {user.role === 'admin' ? (
                                <ShieldAlert className="h-4 w-4 text-[rgba(49,159,67,1)]" />
                              ) : (
                                <Shield className="h-4 w-4 text-gray-400" />
                              )}
                              <span className="capitalize">{user.role}</span>
                            </div>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">
                            <div className="flex items-center gap-2">
                              <Shield className="h-4 w-4" />
                              User
                            </div>
                          </SelectItem>
                          <SelectItem value="admin">
                            <div className="flex items-center gap-2">
                              <ShieldAlert className="h-4 w-4" />
                              Admin
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-gray-500">
                        {getLastSignInTime(user)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge 
                        variant={user.is_blocked ? "destructive" : user.is_active ? "success" : "secondary"}
                        className="font-medium"
                      >
                        {user.is_blocked ? "Blocked" : user.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className={user.is_blocked ? 
                                "text-[rgba(49,159,67,1)] hover:text-[rgba(39,139,57,1)] hover:bg-[rgba(49,159,67,0.1)] border-[rgba(49,159,67,0.2)]" :
                                "text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200"
                              }
                              disabled={blockingUserId === user.id}
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {user.is_blocked ? "Unblock User" : "Block User"}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {user.is_blocked
                                  ? "This will allow the user to access the system again."
                                  : "This will prevent the user from accessing the system."}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleBlockUser(user.id, !user.is_blocked)}
                                className={user.is_blocked ?
                                  "bg-[rgba(49,159,67,1)] hover:bg-[rgba(39,139,57,1)] text-white" :
                                  "bg-amber-600 hover:bg-amber-700 text-white"
                                }
                              >
                                {user.is_blocked ? "Unblock" : "Block"}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                              disabled={deletingUserId === user.id}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete User</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this user? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteUser(user.id)}
                                className="bg-red-600 hover:bg-red-700 text-white"
                              >
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
      </div>
    </div>
  );
};
