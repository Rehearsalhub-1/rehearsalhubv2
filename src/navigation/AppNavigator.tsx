import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
export { navigationRef } from './navigationService';
import { StyleSheet, View } from 'react-native';
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
import SubgroupAdminScreen from '../screens/SubgroupAdminScreen';
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
import PaymentScreen from '../screens/PaymentScreen';
import { theme } from '../constants/Colors';
import { useTheme } from '../context/ThemeContext';
import MediaScreen from '@/screens/MediaScreen';
import StatusScreen from '@/screens/StatusScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator({ initialRoute = 'Login' }: { initialRoute?: string }) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  return (
    <Stack.Navigator 
      initialRouteName={initialRoute}
      screenOptions={{ 
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: theme.colors.background }
      }}
    >
      <Stack.Screen name="Login" component={withErrorBoundary(LoginScreen, 'Login')} />
      <Stack.Screen 
        name="Signup" 
        component={withErrorBoundary((props: any) => (
          <LoginScreen {...props} route={{ ...props.route, params: { ...props.route?.params, mode: 'signup' } }} />
        ), 'Signup')} 
      />
      <Stack.Screen name="Home" component={withErrorBoundary(HomeScreen, 'Home')} />
      <Stack.Screen name="Calendar" component={withErrorBoundary(CalendarScreen, 'Calendar')} />
      <Stack.Screen name="Notifications" component={withErrorBoundary(NotificationsScreen, 'Notifications')} />
      <Stack.Screen name="Lexicon" component={withErrorBoundary(LexiconScreen, 'Lexicon')} />
      <Stack.Screen name="Rehearsal" component={withErrorBoundary(RehearsalScreen, 'Rehearsal')} />
      <Stack.Screen 
        name="Subgroups" 
        component={withErrorBoundary((props: any) => (
          <RehearsalScreen 
            {...props} 
            route={{ 
              ...props.route, 
              params: { ...props.route?.params, mode: 'subgroup', scope: 'subgroup' } 
            }} 
          />
        ), 'Subgroups')} 
      />
      <Stack.Screen name="SubgroupAdmin" component={withErrorBoundary(SubgroupAdminScreen, 'SubgroupAdmin')} />
      <Stack.Screen 
        name="Search" 
        component={withErrorBoundary(SearchScreen, 'Search')} 
        options={{ animation: 'fade' }}
      />
      <Stack.Screen 
        name="Player" 
        component={withErrorBoundary(PlayerScreen, 'Player')} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="Lyrics" 
        component={withErrorBoundary(LyricsScreen, 'Lyrics')} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="Solfa" 
        component={withErrorBoundary(SolfaScreen, 'Solfa')} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="Conductor" 
        component={withErrorBoundary(ConductorScreen, 'Conductor')} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="History" 
        component={withErrorBoundary(HistoryScreen, 'History')} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="Comments" 
        component={withErrorBoundary(CommentsScreen, 'Comments')} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="Details" 
        component={withErrorBoundary(DetailsScreen, 'Details')} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="Archive" 
        component={withErrorBoundary(ArchiveScreen, 'Archive')} 
        options={{ animation: 'fade' }}
      />
      <Stack.Screen 
        name="CategoryPrograms" 
        component={withErrorBoundary(CategoryProgramsScreen, 'CategoryPrograms')} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="Audiolab" 
        component={withErrorBoundary(AudiolabScreen, 'Audiolab')} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="SubmitSong" 
        component={withErrorBoundary(SubmitSongScreen, 'SubmitSong')} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="Karaoke" 
        component={withErrorBoundary(KaraokeScreen, 'Karaoke')} 
        options={{ animation: 'fade' }}
      />
      <Stack.Screen 
        name="AllSongs" 
        component={withErrorBoundary(AllMinisteredSongsScreen, 'AllSongs')} 
        options={{ animation: 'fade' }}
      />
      <Stack.Screen 
        name="Playlists" 
        component={withErrorBoundary(PlaylistsScreen, 'Playlists')} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="ChatRooms" 
        component={withErrorBoundary(ChatListScreen, 'ChatRooms')} 
        options={{ animation: 'fade' }}
      />
      <Stack.Screen 
        name="ChatRoom" 
        component={withErrorBoundary(ChatRoomScreen, 'Chat Room')} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="ChatInfo" 
        component={withErrorBoundary(ChatInfoScreen, 'ChatInfo')} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="NewChat" 
        component={withErrorBoundary(NewChatScreen, 'NewChat')} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="CreateGroup" 
        component={withErrorBoundary(CreateGroupScreen, 'CreateGroup')} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="Calls" 
        component={withErrorBoundary(CallsScreen, 'Calls')} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="Call" 
        component={withErrorBoundary(CallScreen, 'Call')} 
        options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
      />
      <Stack.Screen 
        name="ChatSettings" 
        component={withErrorBoundary(ChatSettingsScreen, 'ChatSettings')} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="Settings" 
        component={withErrorBoundary(SettingsScreen, 'Settings')} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="UserProfile" 
        component={withErrorBoundary(UserProfileScreen, 'UserProfile')} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="Media" 
        component={withErrorBoundary(MediaScreen, 'Media')} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen 
        name="Status" 
        component={withErrorBoundary(StatusScreen, 'Status')} 
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="Links" component={withErrorBoundary(LinksScreen, 'Links')} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="SongsSchedule" component={withErrorBoundary(SongsScheduleScreen, 'SongsSchedule')} options={{ animation: 'slide_from_bottom' }} />
      <Stack.Screen name="Payment" component={withErrorBoundary(PaymentScreen, 'Payment')} options={{ animation: 'slide_from_bottom' }} />
    </Stack.Navigator>
  );
}

const getStyles = (theme: any) => {
  const T = theme.colors;
  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});
};
