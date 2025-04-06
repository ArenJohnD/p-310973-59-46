
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
import { ChevronUp, ChevronDown, Trash, Plus, FileText } from "lucide-react";
import { FileUploadManager } from "@/components/FileUploadManager";

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
      <div className="flex items-center space-x-4 mb-6">
        <Input
          placeholder="New category title"
          value={newCategoryTitle}
          onChange={(e) => setNewCategoryTitle(e.target.value)}
          className="max-w-md"
        />
        <Button 
          onClick={handleCreateCategory}
          className="bg-[rgba(49,159,67,1)] hover:bg-[rgba(39,139,57,1)]"
          disabled={!newCategoryTitle.trim()}
        >
          <Plus className="mr-2 h-4 w-4" /> Add Category
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Order</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="w-[150px]">Visible</TableHead>
              <TableHead className="w-[220px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category, index) => (
              <TableRow key={category.id}>
                <TableCell className="font-medium">
                  <div className="flex flex-col items-center">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="p-1 h-8"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <span>{index + 1}</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleMoveDown(index)}
                      disabled={index === categories.length - 1}
                      className="p-1 h-8"
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
                          className="bg-[rgba(49,159,67,1)] hover:bg-[rgba(39,139,57,1)]"
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
                      className="hover:underline cursor-pointer"
                      onClick={() => {
                        setNewTitle(category.title);
                        setEditTitleId(category.id);
                      }}
                    >
                      {category.title}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={category.is_active}
                    onCheckedChange={(checked) => handleVisibilityChange(category.id, checked)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => openFileManager(category.id)}
                    >
                      <FileText className="h-4 w-4 mr-1" /> Manage Files
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash className="h-4 w-4 mr-1" /> Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the "{category.title}" category and all associated documents. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onDelete(category.id)}
                            className="bg-red-500 hover:bg-red-600"
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
                <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                  No categories found. Create a new category to get started.
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
