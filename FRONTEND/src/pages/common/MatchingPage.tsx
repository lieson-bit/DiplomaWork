import React from 'react';
import { MatchingEngine } from '../../components/MatchingEngine';

/**
 * Matching Engine Page
 * 
 * Displays the intelligent matching algorithm that connects
 * drivers with customers based on capacity, location, and routes.
 */
export function MatchingPage() {
  return <MatchingEngine />;
}

export default MatchingPage;
