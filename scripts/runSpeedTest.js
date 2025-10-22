/**
 * Wrapper to run speed test with auth token
 */

// Set environment variables
process.env.BASE_URL = 'http://localhost:5000';
process.env.AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIwM2VjOTdhYy0xOTM0LTQxODgtODQ3MS01MjQzNjZkODc1MjEiLCJlbWFpbCI6InRlc3RAa29kYS5jb20iLCJpYXQiOjE3NjA5MTEyMDIsImV4cCI6MTc2MDk5NzYwMn0.icgDsKPLFlyK4UvY9FichnG_0X26tMBqMYVLJz4ngvU';
process.env.TEST_USER_ID = '03ec97ac-1934-4188-8471-524366d87521';

// Load the main test script
require('./testChatSpeed.js');
