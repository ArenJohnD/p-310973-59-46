import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ChevronUp, ChevronDown, Trash, Plus, FileText, LayoutGrid, Loader2, RefreshCw } from "lucide-react";
import { FileUploadManager } from "@/components/FileUploadManager";
import { Badge } from "@/components/ui/badge";

interface PolicyCategory {
  id: string;
  title: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface PolicyDocument {
  id: string;
  file_name: string;
  file_path: string;
}

interface AdminCategoryTableProps {
  categories: PolicyCategory[];
  onUpdate: (category: PolicyCategory) => void;
  onDelete: (id: string) => void;
  onCreate: (title: string) => void;
  onReorder: (categories: PolicyCategory[]) => void;
}

export const AdminCategoryTable = ({
  categories,
  onUpdate,
  onDelete,
  onCreate,
  onReorder
}: AdminCategoryTableProps) => {
  const [editTitleId, setEditTitleId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newCategoryTitle, setNewCategoryTitle] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const navigate = useNavigate();

  const handleTitleChange = (id: string, title: string) => {
    const category = categories.find(c => c.id === id);
    if (category) {
      onUpdate({ ...category, title });
    }
    setEditTitleId(null);
  };

  const handleVisibilityChange = (id: string, isActive: boolean) => {
    const category = categories.find(c => c.id === id);
    if (category) {
      onUpdate({ ...category, is_active: isActive });
    }
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    
    const newCategories = [...categories];
    const temp = newCategories[index];
    newCategories[index] = newCategories[index - 1];
    newCategories[index - 1] = temp;
    
    onReorder(newCategories);
  };

  const handleMoveDown = (index: number) => {
    if (index >= categories.length - 1) return;
    
    const newCategories = [...categories];
    const temp = newCategories[index];
    newCategories[index] = newCategories[index + 1];
    newCategories[index + 1] = temp;
    
    onReorder(newCategories);
  };

  const handleCreateCategory = () => {
    if (newCategoryTitle.trim()) {
      onCreate(newCategoryTitle.trim());
      setNewCategoryTitle("");
    }
  };

  const openFileManager = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setFileDialogOpen(true);
  };

  const handleFileDialogClose = () => {
    setSelectedCategoryId(null);
    setFileDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-[rgba(49,159,67,1)]" />
              Category Management
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Manage policy categories and their order
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="font-medium">
              {categories.length} {categories.length === 1 ? 'category' : 'categories'}
            </Badge>
            <Button
              onClick={() => onReorder([...categories])}
              variant="outline"
              size="sm"
              className="gap-1.5"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="flex-1 flex items-center gap-4">
          <Input
            placeholder="Enter new category title..."
            value={newCategoryTitle}
            onChange={(e) => setNewCategoryTitle(e.target.value)}
            className="max-w-md"
          />
          <Button 
            onClick={handleCreateCategory}
            className="bg-[rgba(49,159,67,1)] hover:bg-[rgba(39,139,57,1)] text-white shadow-sm"
            disabled={!newCategoryTitle.trim()}
          >
            <Plus className="mr-2 h-4 w-4" /> Add Category
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-[80px] text-center">Order</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="w-[120px] text-center">Status</TableHead>
              <TableHead className="w-[250px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category, index) => (
              <TableRow key={category.id} className="hover:bg-gray-50/50">
                <TableCell className="font-medium">
                  <div className="flex flex-col items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="p-1 h-7 w-7 rounded-full hover:bg-gray-100"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium">{index + 1}</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleMoveDown(index)}
                      disabled={index === categories.length - 1}
                      className="p-1 h-7 w-7 rounded-full hover:bg-gray-100"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell>
                  {editTitleId === category.id ? (
                    <div className="flex gap-2">
                      <Input
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        autoFocus
                        className="max-w-xs"
                      />
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          onClick={() => handleTitleChange(category.id, newTitle)}
                          className="bg-[rgba(49,159,67,1)] hover:bg-[rgba(39,139,57,1)] text-white"
                          disabled={!newTitle.trim()}
                        >
                          Save
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => setEditTitleId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <span
                      className="hover:text-[rgba(49,159,67,1)] cursor-pointer transition-colors"
                      onClick={() => {
                        setNewTitle(category.title);
                        setEditTitleId(category.id);
                      }}
                    >
                      {category.title}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={category.is_active ? "success" : "secondary"} className="font-medium">
                    {category.is_active ? "Active" : "Hidden"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-2">
                    <Switch
                      checked={category.is_active}
                      onCheckedChange={(checked) => handleVisibilityChange(category.id, checked)}
                      className="data-[state=checked]:bg-[rgba(49,159,67,1)]"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openFileManager(category.id)}
                      className="gap-1.5"
                    >
                      <FileText className="h-4 w-4" />
                      Files
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Category</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this category? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onDelete(category.id)}
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
            ))}
            {categories.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center text-gray-500">
                    <LayoutGrid className="h-8 w-8 mb-2 text-gray-400" />
                    <p className="text-sm font-medium">No categories found</p>
                    <p className="text-sm text-gray-400">Create a new category to get started</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* File Management Dialog */}
      <Dialog open={fileDialogOpen} onOpenChange={setFileDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Manage Files - {categories.find(c => c.id === selectedCategoryId)?.title}
            </DialogTitle>
            <DialogDescription>
              Upload, view, or delete PDF documents for this category.
            </DialogDescription>
          </DialogHeader>
          
          {selectedCategoryId && (
            <div className="py-4">
              <FileUploadManager 
                categoryId={selectedCategoryId} 
                onFileChange={handleFileDialogClose}
                onCancel={handleFileDialogClose}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
