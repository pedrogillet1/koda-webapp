import React from 'react';

const FileBreakdown = () => {
  return (
    <div style={{width: 527, alignSelf: 'stretch', padding: 16, background: 'white', overflow: 'hidden', borderRadius: 20, outline: '1px #E6E6EC solid', outlineOffset: '-1px', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', gap: 16, display: 'inline-flex'}}>
        <div style={{alignSelf: 'stretch', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 16, display: 'inline-flex'}}>
            <div style={{flex: '1 1 0', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: 6, display: 'inline-flex'}}>
                <div style={{alignSelf: 'stretch', justifyContent: 'center', display: 'flex', flexDirection: 'column', color: '#101828', fontSize: 18, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: 26, wordWrap: 'break-word', textShadow: '0px 0px 0px rgba(244, 235, 255, 1.00)'}}>File Breakdown</div>
            </div>
        </div>
        <div style={{alignSelf: 'stretch', flex: '1 1 0', position: 'relative', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', display: 'flex'}}>
            <div style={{width: 360, height: 180, position: 'relative'}}>
                <div style={{width: 360, height: 180, left: 0, top: 0, position: 'absolute', background: 'rgba(0, 0, 0, 0.40)', borderRadius: 12}} />
                <div style={{width: 360, height: 180, left: 0, top: 0, position: 'absolute', background: 'rgba(0, 0, 0, 0.60)', borderRadius: 12}} />
                <div style={{width: 360, height: 180, left: 0, top: 0, position: 'absolute', background: 'rgba(0, 0, 0, 0.80)', borderRadius: 12}} />
                <div style={{width: 360, height: 180, left: 0, top: 0, position: 'absolute', background: 'black', borderRadius: 12}} />
            </div>
            <div style={{alignSelf: 'stretch', padding: 14, background: '#F5F5F5', borderRadius: 18, outline: '1px #E6E6EC solid', outlineOffset: '-1px', justifyContent: 'flex-start', alignItems: 'center', gap: 12, display: 'inline-flex'}}>
                <div style={{flex: '1 1 0', borderRadius: 8, flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', gap: 12, display: 'inline-flex'}}>
                    <div style={{alignSelf: 'stretch', paddingTop: 2, paddingBottom: 2, borderRadius: 8, justifyContent: 'flex-start', alignItems: 'center', gap: 12, display: 'inline-flex'}}>
                        <div style={{width: 40, height: 40, background: 'white', borderRadius: 100, justifyContent: 'center', alignItems: 'center', display: 'flex'}}>
                            <div style={{width: 20, height: 20, position: 'relative'}}>
                                <div style={{width: 11.67, height: 10.83, left: 1.67, top: 5, position: 'absolute', borderRadius: 2.92, outline: '1.25px black solid', outlineOffset: '-0.62px'}} />
                                <div style={{width: 5, height: 9.17, left: 13.34, top: 5.83, position: 'absolute', outline: '1.25px black solid', outlineOffset: '-0.62px'}} />
                            </div>
                        </div>
                        <div style={{flex: '1 1 0', justifyContent: 'flex-start', alignItems: 'center', gap: 10, display: 'flex'}}>
                            <div style={{flex: '1 1 0', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 4, display: 'inline-flex'}}>
                                <div style={{alignSelf: 'stretch', color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: 19.60, wordWrap: 'break-word'}}>Video</div>
                                <div style={{justifyContent: 'center', alignItems: 'center', gap: 10, display: 'inline-flex'}}>
                                    <div style={{color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: 15.40, wordWrap: 'break-word'}}>12 Files</div>
                                    <div style={{width: 6, height: 6, opacity: 0.90, background: '#6C6B6E', borderRadius: 9999}} />
                                    <div style={{color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: 15.40, wordWrap: 'break-word'}}>21 GB</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div style={{alignSelf: 'stretch', paddingTop: 2, paddingBottom: 2, borderRadius: 8, justifyContent: 'flex-start', alignItems: 'center', gap: 12, display: 'inline-flex'}}>
                        <div style={{width: 40, height: 40, background: 'white', borderRadius: 100, justifyContent: 'center', alignItems: 'center', display: 'flex'}}>
                            <div style={{width: 20, height: 20, position: 'relative'}}>
                                <div style={{width: 13.33, height: 16.67, left: 3.33, top: 1.67, position: 'absolute', borderRadius: 4, outline: '1.25px black solid', outlineOffset: '-0.62px'}} />
                                <div style={{width: 3.75, height: 4.58, left: 12.50, top: 2.08, position: 'absolute', outline: '1.25px black solid', outlineOffset: '-0.62px'}} />
                            </div>
                        </div>
                        <div style={{flex: '1 1 0', justifyContent: 'flex-start', alignItems: 'center', gap: 10, display: 'flex'}}>
                            <div style={{flex: '1 1 0', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 4, display: 'inline-flex'}}>
                                <div style={{alignSelf: 'stretch', color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: 19.60, wordWrap: 'break-word'}}>Document</div>
                                <div style={{justifyContent: 'center', alignItems: 'center', gap: 10, display: 'inline-flex'}}>
                                    <div style={{color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: 15.40, wordWrap: 'break-word'}}>8 Files</div>
                                    <div style={{width: 6, height: 6, opacity: 0.90, background: '#6C6B6E', borderRadius: 9999}} />
                                    <div style={{color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: 15.40, wordWrap: 'break-word'}}>14 GB</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div style={{flex: '1 1 0', borderRadius: 8, flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', gap: 12, display: 'inline-flex'}}>
                    <div style={{alignSelf: 'stretch', paddingTop: 2, paddingBottom: 2, borderRadius: 8, justifyContent: 'flex-start', alignItems: 'center', gap: 12, display: 'inline-flex'}}>
                        <div style={{width: 40, height: 40, background: 'white', borderRadius: 100, justifyContent: 'center', alignItems: 'center', display: 'flex'}}>
                            <div style={{width: 20, height: 20, position: 'relative'}}>
                                <div style={{width: 16.67, height: 16.67, left: 1.67, top: 1.67, position: 'absolute', borderRadius: 4.17, outline: '1.25px black solid', outlineOffset: '-0.62px'}} />
                                <div style={{width: 16.25, height: 5.83, left: 2.08, top: 9.17, position: 'absolute', outline: '1.25px black solid', outlineOffset: '-0.62px'}} />
                                <div style={{width: 3.33, height: 3.33, left: 8.33, top: 8.33, position: 'absolute', transform: 'rotate(180deg)', transformOrigin: 'top left', borderRadius: 9999, outline: '1.25px black solid', outlineOffset: '-0.62px'}} />
                            </div>
                        </div>
                        <div style={{flex: '1 1 0', justifyContent: 'flex-start', alignItems: 'center', gap: 10, display: 'flex'}}>
                            <div style={{flex: '1 1 0', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 4, display: 'inline-flex'}}>
                                <div style={{alignSelf: 'stretch', color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: 19.60, wordWrap: 'break-word'}}>Image</div>
                                <div style={{justifyContent: 'center', alignItems: 'center', gap: 10, display: 'inline-flex'}}>
                                    <div style={{color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: 15.40, wordWrap: 'break-word'}}>3 Files</div>
                                    <div style={{width: 6, height: 6, opacity: 0.90, background: '#6C6B6E', borderRadius: 9999}} />
                                    <div style={{color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: 15.40, wordWrap: 'break-word'}}>4 GB</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div style={{alignSelf: 'stretch', paddingTop: 2, paddingBottom: 2, borderRadius: 8, justifyContent: 'flex-start', alignItems: 'center', gap: 12, display: 'inline-flex'}}>
                        <div style={{width: 40, height: 40, background: 'white', borderRadius: 100, justifyContent: 'center', alignItems: 'center', display: 'flex'}}>
                            <div style={{width: 20, height: 20, position: 'relative'}}>
                                <div style={{width: 16.67, height: 16.67, left: 1.67, top: 1.67, position: 'absolute', borderRadius: 10, outline: '1.25px black solid', outlineOffset: '-0.62px'}} />
                            </div>
                        </div>
                        <div style={{flex: '1 1 0', justifyContent: 'flex-start', alignItems: 'center', gap: 10, display: 'flex'}}>
                            <div style={{flex: '1 1 0', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 4, display: 'inline-flex'}}>
                                <div style={{alignSelf: 'stretch', color: '#32302C', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: 19.60, wordWrap: 'break-word'}}>Other</div>
                                <div style={{justifyContent: 'center', alignItems: 'center', gap: 10, display: 'inline-flex'}}>
                                    <div style={{color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: 15.40, wordWrap: 'break-word'}}>4 Files</div>
                                    <div style={{width: 6, height: 6, opacity: 0.90, background: '#6C6B6E', borderRadius: 9999}} />
                                    <div style={{color: '#6C6B6E', fontSize: 14, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: 15.40, wordWrap: 'break-word'}}>461 MB</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div style={{left: 196, top: 90, position: 'absolute', borderRadius: 8, flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', display: 'flex'}}>
                <div style={{alignSelf: 'stretch', color: '#32302C', fontSize: 30, fontFamily: 'Plus Jakarta Sans', fontWeight: '600', lineHeight: 42, wordWrap: 'break-word'}}>21 Files</div>
                <div style={{alignSelf: 'stretch', textAlign: 'center', color: '#6C6B6E', fontSize: 16, fontFamily: 'Plus Jakarta Sans', fontWeight: '500', lineHeight: 22.40, wordWrap: 'break-word'}}>Total</div>
            </div>
        </div>
    </div>
  );
};

export default FileBreakdown;
