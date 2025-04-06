
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/use-toast";
import { Header } from "@/components/Header";
import { AdminCategoryTable } from "@/components/AdminCategoryTable";
import { Tables } from "@/integrations/supabase/types";

type PolicyCategory = Tables<"policy_categories">;

const Admin = () => {
  const [categories, setCategories] = useState<PolicyCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const { data, error } = await supabase.rpc('is_admin');
        
        if (error) {
          console.error("Error checking admin status:", error);
          toast({
            title: "Error",
            description: "Failed to verify admin privileges",
            variant: "destructive",
          });
          setIsAdmin(false);
          return;
        }

        setIsAdmin(data);
        
        if (!data) {
          toast({
            title: "Access Denied",
            description: "You don't have admin privileges to access this page",
            variant: "destructive",
          });
        } else {
          fetchCategories();
        }
      } catch (error) {
        console.error("Error in admin check:", error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkAdminStatus();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('policy_categories')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
      toast({
        title: "Error",
        description: "Failed to load policy categories",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCategoryUpdate = async (category: PolicyCategory) => {
    try {
      const { error } = await supabase
        .from('policy_categories')
        .update({
          title: category.title,
          is_active: category.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', category.id);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Category updated successfully",
      });
      
      // Update local state
      setCategories(categories.map(c => 
        c.id === category.id ? { ...c, ...category } : c
      ));
    } catch (error) {
      console.error("Error updating category:", error);
      toast({
        title: "Error",
        description: "Failed to update category",
        variant: "destructive",
      });
    }
  };

  const handleCategoryDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('policy_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Category deleted successfully",
      });
      
      // Update local state
      setCategories(categories.filter(c => c.id !== id));
    } catch (error) {
      console.error("Error deleting category:", error);
      toast({
        title: "Error",
        description: "Failed to delete category",
        variant: "destructive",
      });
    }
  };

  const handleCategoryCreate = async (title: string) => {
    try {
      // Get the highest display_order
      const maxOrder = categories.length > 0 
        ? Math.max(...categories.map(c => c.display_order))
        : 0;
      
      const { data, error } = await supabase
        .from('policy_categories')
        .insert({
          title,
          display_order: maxOrder + 1,
        })
        .select();

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "New category created successfully",
      });
      
      // Update local state
      if (data && data.length > 0) {
        setCategories([...categories, data[0]]);
      }
    } catch (error) {
      console.error("Error creating category:", error);
      toast({
        title: "Error",
        description: "Failed to create new category",
        variant: "destructive",
      });
    }
  };

  const handleReorderCategories = async (reorderedCategories: PolicyCategory[]) => {
    try {
      // Update local state immediately for responsive UI
      setCategories(reorderedCategories);
      
      // Prepare batch updates with new display_order values
      const updates = reorderedCategories.map((category, index) => ({
        id: category.id,
        display_order: index + 1,
        updated_at: new Date().toISOString(),
      }));
      
      // Use Promise.all to update all categories in parallel
      await Promise.all(
        updates.map(update => 
          supabase
            .from('policy_categories')
            .update({ display_order: update.display_order, updated_at: update.updated_at })
            .eq('id', update.id)
        )
      );
      
      toast({
        title: "Success",
        description: "Categories reordered successfully",
      });
    } catch (error) {
      console.error("Error reordering categories:", error);
      toast({
        title: "Error",
        description: "Failed to reorder categories",
        variant: "destructive",
      });
      // Revert to the original order by refetching
      fetchCategories();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-[rgba(233,233,233,1)]">
        <Header />
        <main className="bg-white flex-1 mt-[29px] px-20 py-[52px] rounded-[40px_40px_0px_0px] max-md:px-5">
          <div className="flex justify-center items-center h-64">
            <p className="text-xl">Loading...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col bg-[rgba(233,233,233,1)]">
        <Header />
        <main className="bg-white flex-1 mt-[29px] px-20 py-[52px] rounded-[40px_40px_0px_0px] max-md:px-5">
          <div className="flex flex-col justify-center items-center h-64">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
            <p className="text-gray-700">
              You don't have admin privileges to access this page.
            </p>
            <p className="text-gray-500 mt-2">
              Only accounts with @admin.neu.edu.ph email addresses can access the admin panel.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[rgba(233,233,233,1)]">
      <Header />
      <main className="bg-white flex-1 mt-[29px] px-20 py-[52px] rounded-[40px_40px_0px_0px] max-md:px-5">
        <section className="text-center mb-8">
          <h1 className="text-black text-3xl font-bold">
            Admin Dashboard
          </h1>
          <p className="text-black text-xl mt-2">
            Manage Policy Categories
          </p>
        </section>

        <AdminCategoryTable 
          categories={categories}
          onUpdate={handleCategoryUpdate}
          onDelete={handleCategoryDelete}
          onCreate={handleCategoryCreate}
          onReorder={handleReorderCategories}
        />
      </main>
    </div>
  );
};

export default Admin;
