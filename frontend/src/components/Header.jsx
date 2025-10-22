import React from 'react';
import SearchIcon from './icons/SearchIcon';
import UploadIcon from './icons/UploadIcon';
import NotificationCenter from './NotificationCenter';

const Header = () => {
  return (
    <div style={{alignSelf: 'stretch', height: 84, paddingLeft: 20, paddingRight: 20, background: 'white', borderBottom: '1px #E6E6EC solid', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex'}}>
        <div style={{textAlign: 'center', color: '#32302C', fontSize: 20, fontFamily: 'Plus Jakarta Sans', fontWeight: '700', textTransform: 'capitalize', lineHeight: 30, wordWrap: 'break-word'}}>Welcome back, Mark!</div>
        <div style={{justifyContent: 'flex-start', alignItems: 'center', gap: 12, display: 'flex'}}>
            <div style={{flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 12, display: 'inline-flex'}}>
                <div style={{height: 52, justifyContent: 'flex-start', alignItems: 'flex-start', gap: 6, display: 'inline-flex'}}>
                    <div style={{height: 52, paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10, background: '#F5F5F5', boxShadow: '0px 0px 8px 1px rgba(0, 0, 0, 0.02)', overflow: 'hidden', borderRadius: 100, outline: '1px #E6E6EC solid', outlineOffset: '-1px', justifyContent: 'center', alignItems: 'center', gap: 6, display: 'flex'}}>
                        <div style={{justifyContent: 'flex-start', alignItems: 'center', gap: 8, display: 'flex'}}>
                            <SearchIcon />
                            <div style={{color: '#32302C', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: 24, wordWrap: 'break-word'}}>Search any documents...</div>
                        </div>
                    </div>
                </div>
            </div>
            <div style={{flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 12, display: 'inline-flex'}}>
                <div style={{height: 52, justifyContent: 'flex-start', alignItems: 'flex-start', gap: 6, display: 'inline-flex'}}>
                    <div style={{height: 52, paddingLeft: 18, paddingRight: 18, paddingTop: 10, paddingBottom: 10, background: '#F5F5F5', boxShadow: '0px 0px 8px 1px rgba(0, 0, 0, 0.02)', overflow: 'hidden', borderRadius: 100, outline: '1px #E6E6EC solid', outlineOffset: '-1px', justifyContent: 'center', alignItems: 'center', gap: 6, display: 'flex'}}>
                        <div style={{justifyContent: 'flex-start', alignItems: 'center', gap: 8, display: 'flex'}}>
                            <UploadIcon />
                            <div style={{color: '#32302C', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: 24, wordWrap: 'break-word'}}>Upload a Document</div>
                        </div>
                    </div>
                </div>
            </div>
            <NotificationCenter />
        </div>
    </div>
  );
};

export default Header;
