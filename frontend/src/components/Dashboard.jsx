import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import CategoryGrid from './CategoryGrid';
import FileBreakdown from './FileBreakdown';
import UpcomingActions from './UpcomingActions';
import QuickAccess from './QuickAccess';

const Dashboard = () => {
  return (
    <div style={{ width: '100%', height: '100%', background: '#F5F5F5', overflow: 'hidden', justifyContent: 'flex-start', alignItems: 'center', display: 'flex' }}>
      <Sidebar />
      <div style={{ flex: '1 1 0', height: '100%', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex' }}>
        <Header />
        <div style={{ alignSelf: 'stretch', flex: '1 1 0', padding: 20, overflow: 'auto', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', gap: 20, display: 'flex' }}>
          <CategoryGrid />
          <div style={{alignSelf: 'stretch', flex: '1 1 0', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 20, display: 'inline-flex'}}>
            <FileBreakdown />
            <div style={{flex: '1 1 0', alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 20, display: 'inline-flex'}}>
              <UpcomingActions />
              <QuickAccess />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
