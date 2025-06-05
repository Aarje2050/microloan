// src/navigation/AppNavigator.tsx
// FIXED - Proper role-based navigation without mixing Tab/Stack incorrectly

import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from '@react-navigation/stack';


import { Ionicons } from "@expo/vector-icons";
import { User } from "../types";

// Import role-specific navigators
import { SuperAdminTabNavigator } from "./SuperAdminTabNavigator";
import { LenderStackNavigator } from "./LenderStackNavigator";
import { BorrowerTabNavigator } from "./BorrowerTabNavigator";
import { BorrowerStackNavigator } from './BorrowerStackNavigator';
// Add to your navigation stack as needed

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

interface AppNavigatorProps {
  user: User;
}

export const AppNavigator: React.FC<AppNavigatorProps> = ({ user }) => {
  
  // Route user to appropriate navigator based on role
  switch (user.role) {
    case "super_admin":
      return <SuperAdminTabNavigator />;

    case "lender":
      return <LenderStackNavigator />;

    case "borrower":
      return <BorrowerStackNavigator />;

    default:
      // Fallback to borrower if role is unclear
      return <BorrowerTabNavigator />;
  }
};