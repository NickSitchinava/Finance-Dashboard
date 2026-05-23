import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../components/auth/AuthProvider";

export interface ClientCategory {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface CategoryAssignment {
  id: string;
  client_id: string;
  category_id: string;
}

export function useCategoryAssignments() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<ClientCategory[]>([]);
  const [assignments, setAssignments] = useState<CategoryAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchAll() {
    if (!user) return;
    setLoading(true);
    const [{ data: cats }, { data: assigns }] = await Promise.all([
      supabase
        .from("client_categories")
        .select("*")
        .eq("user_id", user.id)
        .order("name"),
      supabase
        .from("client_category_assignments")
        .select("*"),
    ]);
    if (cats) setCategories(cats);
    if (assigns) setAssignments(assigns);
    setLoading(false);
  }

  async function createCategory(name: string, color: string): Promise<ClientCategory | null> {
    if (!user) return null;
    const { data, error } = await supabase
      .from("client_categories")
      .insert([{ name: name.trim(), color, user_id: user.id }])
      .select()
      .single();
    if (error || !data) return null;
    setCategories((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    return data;
  }

  async function updateCategory(id: string, name: string, color: string): Promise<boolean> {
    const { error } = await supabase
      .from("client_categories")
      .update({ name: name.trim(), color })
      .eq("id", id);
    if (error) return false;
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, name: name.trim(), color } : c))
        .sort((a, b) => a.name.localeCompare(b.name))
    );
    return true;
  }

  async function deleteCategory(id: string): Promise<boolean> {
    const { error } = await supabase
      .from("client_categories")
      .delete()
      .eq("id", id);
    if (error) return false;
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setAssignments((prev) => prev.filter((a) => a.category_id !== id));
    return true;
  }

  async function saveAssignmentsForClient(clientId: string, categoryIds: string[]): Promise<boolean> {
    const existing = assignments.filter((a) => a.client_id === clientId);
    const existingIds = existing.map((a) => a.category_id);

    const toAdd = categoryIds.filter((id) => !existingIds.includes(id));
    const toRemove = existing.filter((a) => !categoryIds.includes(a.category_id));

    if (toRemove.length > 0) {
      await supabase
        .from("client_category_assignments")
        .delete()
        .in("id", toRemove.map((a) => a.id));
    }

    if (toAdd.length > 0) {
      await supabase
        .from("client_category_assignments")
        .insert(toAdd.map((category_id) => ({ client_id: clientId, category_id })));
    }

    setAssignments((prev) => {
      const filtered = prev.filter(
        (a) => a.client_id !== clientId || categoryIds.includes(a.category_id)
      );
      const newAssigns = toAdd.map((category_id) => ({
        id: crypto.randomUUID(),
        client_id: clientId,
        category_id,
      }));
      return [...filtered, ...newAssigns];
    });

    return true;
  }

  const getCategoriesForClient = useCallback(
    (clientId: string): ClientCategory[] => {
      const ids = assignments
        .filter((a) => a.client_id === clientId)
        .map((a) => a.category_id);
      return categories.filter((c) => ids.includes(c.id));
    },
    [assignments, categories]
  );

  const getClientsCountForCategory = useCallback(
    (categoryId: string): number => {
      return assignments.filter((a) => a.category_id === categoryId).length;
    },
    [assignments]
  );

  useEffect(() => {
    fetchAll();
  }, [user]);

  return {
    categories,
    assignments,
    loading,
    fetchAll,
    createCategory,
    updateCategory,
    deleteCategory,
    saveAssignmentsForClient,
    getCategoriesForClient,
    getClientsCountForCategory,
  };
}