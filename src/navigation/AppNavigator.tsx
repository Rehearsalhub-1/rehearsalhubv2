import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
export { navigationRef } from './navigationService';
import { StyleSheet } from 'react-native';
import { withErrorBoundary } from '../components/ScreenErrorBoundary';

import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import CalendarScreen from '../screens/CalendarScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import LexiconScreen from '../screens/LexiconScreen';
import SearchScreen from '../screens/SearchScreen';
import RehearsalScreen from '../screens/RehearsalScreen';
import PlayerScreen from '../screens/PlayerScreen';
import LyricsScreen from '../screens/LyricsScreen';
import SolfaScreen from '../screens/SolfaScreen';
import ConductorScreen from '../screens/ConductorScreen';
import HistoryScreen from '../screens/HistoryScreen';
import CommentsScreen from '../screens/CommentsScreen';
import DetailsScreen from '../screens/DetailsScreen';
import ArchiveScreen from '../screens/ArchiveScreen';
import CategoryProgramsScreen from '../screens/CategoryProgramsScreen';
import AudiolabScreen from '../screens/AudiolabScreen';
import SubmitSongScreen from '../screens/SubmitSongScreen';
import KaraokeScreen from '../screens/KaraokeScreen';
import AllMinisteredSongsScreen from '../screens/AllMinisteredSongsScreen';
import PlaylistsScreen from '../screens/PlaylistsScreen';
import ChatListScreen from '../screens/ChatListScreen';
import ChatRoomScreen from '../screens/ChatRoomScreen';
import ChatInfoScreen from '../screens/ChatInfoScreen';
import NewChatScreen from '../screens/NewChatScreen';
import CreateGroupScreen from '../screens/CreateGroupScreen';
import CallsScreen from '../screens/CallsScreen';
import CallScreen from '../screens/CallScreen';
import ChatSettingsScreen from '../screens/ChatSettingsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import LinksScreen from '../screens/LinksScreen';
import SongsScheduleScreen from '../screens/SongsScheduleScreen';
import { useTheme } from '../context/ThemeContext';
import MediaScreen from '@/screens/MediaScreen';

// Wrap all screens statically at module level to guarantee stable component identity across renders
const SafeLoginScreen = withErrorBoundary(LoginScreen, 'Login');
const SafeHomeScreen = withErrorBoundary(HomeScreen, 'Home');
const SafeCalendarScreen = withErrorBoundary(CalendarScreen, 'Calendar');
const SafeNotificationsScreen = withErrorBoundary(NotificationsScreen, 'Notifications');
const SafeLexiconScreen = withErrorBoundary(LexiconScreen, 'Lexicon');
const SafeSearchScreen = withErrorBoundary(SearchScreen, 'Search');
const SafeRehearsalScreen = withErrorBoundary(RehearsalScreen, 'Rehearsal');
const SafePlayerScreen = withErrorBoundary(PlayerScreen, 'Player');
const SafeLyricsScreen = withErrorBoundary(LyricsScreen, 'Lyrics');
const SafeSolfaScreen = withErrorBoundary(SolfaScreen, 'Solfa');
const SafeConductorScreen = withErrorBoundary(ConductorScreen, 'Conductor');
const SafeHistoryScreen = withErrorBoundary(HistoryScreen, 'History');
const SafeCommentsScreen = withErrorBoundary(CommentsScreen, 'Comments');
const SafeDetailsScreen = withErrorBoundary(DetailsScreen, 'Details');
const SafeArchiveScreen = withErrorBoundary(ArchiveScreen, 'Archive');
const SafeCategoryProgramsScreen = withErrorBoundary(CategoryProgramsScreen, 'CategoryPrograms');
const SafeAudiolabScreen = withErrorBoundary(AudiolabScreen, 'Audiolab');
const SafeSubmitSongScreen = withErrorBoundary(SubmitSongScreen, 'SubmitSong');
const SafeKaraokeScreen = withErrorBoundary(KaraokeScreen, 'Karaoke');
const SafeAllMinisteredSongsScreen = withErrorBoundary(AllMinisteredSongsScreen, 'AllSongs');
const SafePlaylistsScreen = withErrorBoundary(PlaylistsScreen, 'Playlists');
const SafeChatListScreen = withErrorBoundary(ChatListScreen, 'ChatRooms');
const SafeChatRoomScreen = withErrorBoundary(ChatRoomScreen, 'Chat Room');
const SafeChatInfoScreen = withErrorBoundary(ChatInfoScreen, 'ChatInfo');
const SafeNewChatScreen = withErrorBoundary(NewChatScreen, 'NewChat');
const SafeCreateGroupScreen = withErrorBoundary(CreateGroupScreen, 'CreateGroup');
const SafeCallsScreen = withErrorBoundary(CallsScreen, 'Calls');
const SafeCallScreen = withErrorBoundary(CallScreen, 'Call');
const SafeChatSettingsScreen = withErrorBoundary(ChatSettingsScreen, 'ChatSettings');
const SafeSettingsScreen = withErrorBoundary(SettingsScreen, 'Settings');
const SafeUserProfileScreen = withErrorBoundary(UserProfileScreen, 'UserProfile');
const SafeMediaScreen = withErrorBoundary(MediaScreen, 'Media');
const SafeLinksScreen = withErrorBoundary(LinksScreen, 'Links');
const SafeSongsScheduleScreen = withErrorBoundary(SongsScheduleScreen, 'SongsSchedule');

const SignupScreenWrapper = withErrorBoundary((props: any) => (
  <LoginScreen {...props} route={{ ...props.route, params: { ...props.route?.params, mode: 'signup' } }} />
), 'Signup');

const SubgroupsScreenWrapper = withErrorBoundary((props: any) => (
  <RehearsalScreen 
    {...props} 
    route={{ 
      ...props.route, 
      params: { ...props.route?.params, mode: 'subgroup', scope: 'subgroup' } 
    }} 
  />
), 'Subgroups');

const Stack = createNativeStackNavigator();

export default function AppNavigator({ initialRoute = 'Login' }: { initialRoute?: string }) {
  const { theme } = useTheme();

  return (
    <Stack.Navigator 
      initialRouteName={initialRoute}
      screenOptions={{ 
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: theme.colors.background }
      }}
    >
      <Stack.Screen name="Login" component={SafeLoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreenWrapper} />
      <Stack.Screen name="Home" component={SafeHomeScreen} />
      <Stack.Screen name="Calendar" component={SafeCalendarScreen} />
      <Stack.Screen name="Notifications" component={SafeNotificationsScreen} />
      <Stack.Screen name="Lexicon" component={SafeLexiconScreen} />
      <Stack.Screen name="Rehearsal" component={SafeRehearsalScreen} />
      <Stack.Screen name="Subgroups" component={SubgroupsScreenWrapper} />
      <Stack.Screen 
        name="Search" 
        component={SafeSearchScreen} 
        options={{ animation: 'fade' }}
      />
      <Stack.Screen 
        name="Player" 
        component={SafePlayerScreen} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="Lyrics" 
        component={SafeLyricsScreen} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="Solfa" 
        component={SafeSolfaScreen} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="Conductor" 
        component={SafeConductorScreen} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="History" 
        component={SafeHistoryScreen} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="Comments" 
        component={SafeCommentsScreen} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="Details" 
        component={SafeDetailsScreen} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="Archive" 
        component={SafeArchiveScreen} 
        options={{ animation: 'fade' }}
      />
      <Stack.Screen 
        name="CategoryPrograms" 
        component={SafeCategoryProgramsScreen} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="Audiolab" 
        component={SafeAudiolabScreen} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="SubmitSong" 
        component={SafeSubmitSongScreen} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="Karaoke" 
        component={SafeKaraokeScreen} 
        options={{ animation: 'fade' }}
      />
      <Stack.Screen 
        name="AllSongs" 
        component={SafeAllMinisteredSongsScreen} 
        options={{ animation: 'fade' }}
      />
      <Stack.Screen 
        name="Playlists" 
        component={SafePlaylistsScreen} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="ChatRooms" 
        component={SafeChatListScreen} 
        options={{ animation: 'fade' }}
      />
      <Stack.Screen 
        name="ChatRoom" 
        component={SafeChatRoomScreen} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="ChatInfo" 
        component={SafeChatInfoScreen} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="NewChat" 
        component={SafeNewChatScreen} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="CreateGroup" 
        component={SafeCreateGroupScreen} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="Calls" 
        component={SafeCallsScreen} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="Call" 
        component={SafeCallScreen} 
        options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
      />
      <Stack.Screen 
        name="ChatSettings" 
        component={SafeChatSettingsScreen} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="Settings" 
        component={SafeSettingsScreen} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="UserProfile" 
        component={SafeUserProfileScreen} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="Media" 
        component={SafeMediaScreen} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="Links" component={SafeLinksScreen} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="SongsSchedule" component={SafeSongsScheduleScreen} options={{ animation: 'slide_from_bottom' }} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({});
