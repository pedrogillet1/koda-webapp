import React from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import CategoryGrid from './CategoryGrid';
import FileBreakdownDonut from './FileBreakdownDonut';
import UpcomingActions from './UpcomingActions';
import QuickAccess from './QuickAccess';
import { useIsMobile } from '../hooks/useIsMobile';
import LeftNav from './LeftNav';

const Dashboard = () => {
  const isMobile = useIsMobile();

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: '#F5F5F5',
      overflow: 'hidden',
      justifyContent: 'flex-start',
      alignItems: 'center',
      display: 'flex'
    }}>
      {/* Use LeftNav for mobile, Sidebar for desktop */}
      {isMobile ? <LeftNav /> : <Sidebar />}

      <div style={{
        flex: '1 1 0',
        height: '100%',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        display: 'flex',
        overflow: 'hidden'
      }}>
        <Header />

        <div style={{
          alignSelf: 'stretch',
          flex: '1 1 0',
          padding: isMobile ? 12 : 20,
          overflow: 'auto',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'center',
          gap: isMobile ? 12 : 20,
          display: 'flex'
        }}>
          {/* Category Grid - full width on mobile */}
          <CategoryGrid />

          {/* File Breakdown and Actions - stack vertically on mobile */}
          <div style={{
            alignSelf: 'stretch',
            flex: '1 1 0',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            gap: isMobile ? 12 : 20,
            display: isMobile ? 'flex' : 'inline-flex',
            flexDirection: isMobile ? 'column' : 'row'
          }}>
            {/* File Breakdown - full width on mobile */}
            <div style={{
              flex: isMobile ? 'none' : '1 1 0',
              width: isMobile ? '100%' : 'auto',
              minHeight: isMobile ? '300px' : 'auto'
            }}>
              <FileBreakdownDonut showEncryptionMessage={false} />
            </div>

            {/* Upcoming Actions and Quick Access - stack vertically */}
            <div style={{
              flex: isMobile ? 'none' : '1 1 0',
              width: isMobile ? '100%' : 'auto',
              alignSelf: 'stretch',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'flex-start',
              gap: isMobile ? 12 : 20,
              display: 'flex'
            }}>
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
