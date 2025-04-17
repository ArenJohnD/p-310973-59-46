
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { useForm } from "react-hook-form";
import { Shield, ShieldCheck, UserCog, Loader2 } from "lucide-react";

interface UserWithProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  created_at: string;
  last_sign_in_at: string | null;
}

export const UserManagement = () => {
  const [users, setUsers] = useState<UserWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserWithProfile | null>(null);
  const [updating, setUpdating] = useState(false);

  const form = useForm({
    defaultValues: {
      role: "user",
    },
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedUser) {
      form.setValue("role", selectedUser.role);
    }
  }, [selectedUser, form]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_all_users_with_profiles");

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = (user: UserWithProfile) => {
    setSelectedUser(user);
  };

  const handleUpdateRole = async (values: { role: string }) => {
    if (!selectedUser) return;

    try {
      setUpdating(true);
      
      const { data, error } = await supabase.rpc("update_user_role", {
        user_id: selectedUser.id,
        new_role: values.role,
      });

      if (error) throw error;
      
      // Update local state
      setUsers(
        users.map((user) =>
          user.id === selectedUser.id ? { ...user, role: values.role } : user
        )
      );
      
      setSelectedUser(prev => prev ? {...prev, role: values.role} : null);
      
      toast({
        title: "Success",
        description: `User role updated to ${values.role}`,
      });
    } catch (error) {
      console.error("Error updating user role:", error);
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
              <CardDescription>
                Manage user accounts and permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center h-40">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                </div>
              ) : (
                <Table>
                  <TableCaption>List of all registered users</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow 
                        key={user.id}
                        className={selectedUser?.id === user.id ? "bg-muted" : ""}
                      >
                        <TableCell className="font-medium">{user.email}</TableCell>
                        <TableCell>{user.full_name || "-"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {user.role === "admin" ? (
                              <ShieldCheck className="h-4 w-4 text-green-600" />
                            ) : (
                              <Shield className="h-4 w-4 text-gray-500" />
                            )}
                            {user.role}
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(user.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          {user.last_sign_in_at
                            ? new Date(user.last_sign_in_at).toLocaleDateString()
                            : "Never"}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSelectUser(user)}
                          >
                            Edit
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5" />
                Edit User Role
              </CardTitle>
              <CardDescription>
                Change permissions for the selected user
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedUser ? (
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(handleUpdateRole)}
                    className="space-y-6"
                  >
                    <div className="text-sm space-y-1">
                      <div>
                        <span className="font-semibold">Email:</span> {selectedUser.email}
                      </div>
                      <div>
                        <span className="font-semibold">Name:</span>{" "}
                        {selectedUser.full_name || "N/A"}
                      </div>
                      <div>
                        <span className="font-semibold">Current Role:</span>{" "}
                        {selectedUser.role}
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel>Role</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="flex flex-col space-y-1"
                            >
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="admin" />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  Admin - Full access to dashboard and management
                                </FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-3 space-y-0">
                                <FormControl>
                                  <RadioGroupItem value="user" />
                                </FormControl>
                                <FormLabel className="font-normal">
                                  User - Standard access
                                </FormLabel>
                              </FormItem>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button 
                      type="submit" 
                      disabled={updating}
                      className="w-full"
                    >
                      {updating && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Update Role
                    </Button>
                  </form>
                </Form>
              ) : (
                <div className="text-center text-gray-500 py-4">
                  Select a user to edit their role
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
