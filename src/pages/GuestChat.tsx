
import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { Header } from "@/components/Header";

export default function GuestChat() {
  // This page is now obsolete, redirect to login
  return <Navigate to="/login" replace />;
}
