import React, { useState, useEffect, createContext } from 'react';
import isEqual from 'react-fast-compare';
import axios from 'axios';

import VerifyView from '../views/VerifyView';
import GrowersView from '../views/GrowersView';
import CapturesView from '../views/CapturesView';
import EarningsView from '../views/EarningsView/EarningsView';
import PaymentsView from '../views/PaymentsView/PaymentsView';
import MessagingView from 'views/MessagingView';
import Account from '../components/Account';
import Home from '../components/Home/Home';
import Users from '../components/Users';
import SpeciesView from '../views/SpeciesView';
import CaptureMatchingView from '../components/CaptureMatching/CaptureMatchingView';
import { MessagingProvider } from './MessagingContext';
import Unauthorized from '../components/Unauthorized';

import IconSettings from '@material-ui/icons/Settings';
import IconShowChart from '@material-ui/icons/ShowChart';
import IconThumbsUpDown from '@material-ui/icons/ThumbsUpDown';
import IconNature from '@material-ui/icons/Nature';
import IconNaturePeople from '@material-ui/icons/NaturePeople';
import IconGroup from '@material-ui/icons/Group';
import PaymentsIcon from '../components/images/PaymentsIcon';
import IconPermIdentity from '@material-ui/icons/PermIdentity';
import CategoryIcon from '@material-ui/icons/Category';
import HomeIcon from '@material-ui/icons/Home';
import CompareIcon from '@material-ui/icons/Compare';
import CreditCardIcon from '@material-ui/icons/CreditCard';
import InboxRounded from '@material-ui/icons/InboxRounded';
import { session, hasPermission, POLICIES } from '../models/auth';
import api from '../api/treeTrackerApi';

// no initial context here because we want login values to be 'undefined' until they are confirmed
export const AppContext = createContext({});

function getRoutes(user) {
  return [
    {
      name: 'Home',
      linkTo: '/',
      exact: true,
      component: Home,
      icon: HomeIcon,
      disabled: false,
    },
    {
      name: 'Monitor',
      linkTo: '/monitor',
      icon: IconShowChart,
      disabled: true,
    },
    {
      name: 'Verify',
      linkTo: '/verify',
      component: VerifyView,
      icon: IconThumbsUpDown,
      disabled: !hasPermission(user, [
        POLICIES.SUPER_PERMISSION,
        POLICIES.LIST_TREE,
        POLICIES.APPROVE_TREE,
      ]),
    },
    {
      name: 'Captures',
      linkTo: '/captures',
      component: CapturesView,
      icon: IconNature,
      disabled: !hasPermission(user, [
        POLICIES.SUPER_PERMISSION,
        POLICIES.LIST_TREE,
      ]),
    },
    {
      name: 'Capture Matching',
      linkTo: '/capture-matching',
      component: CaptureMatchingView,
      icon: CompareIcon,
      disabled:
        process.env.REACT_APP_ENABLE_CAPTURE_MATCHING !== 'true' ||
        !hasPermission(user, [
          POLICIES.SUPER_PERMISSION,
          POLICIES.APPROVE_TREE,
        ]),
    },
    {
      name: 'Earnings',
      children: [
        {
          name: 'Earnings',
          linkTo: '/earnings',
          component: EarningsView,
          icon: CreditCardIcon,
          disabled: process.env.REACT_APP_ENABLE_EARNINGS !== 'true',
        },
        {
          name: 'Payments',
          linkTo: '/payments',
          component: PaymentsView,
          icon: PaymentsIcon,
          disabled: process.env.REACT_APP_ENABLE_PAYMENTS !== 'true',
        },
      ],
      disabled:
        process.env.REACT_APP_ENABLE_EARNINGS !== 'true' &&
        process.env.REACT_APP_ENABLE_PAYMENTS !== 'true',
    },
    {
      name: 'Growers',
      linkTo: '/growers',
      component: GrowersView,
      icon: IconNaturePeople,
      disabled: !hasPermission(user, [
        POLICIES.SUPER_PERMISSION,
        POLICIES.LIST_GROWER,
      ]),
    },
    {
      name: 'Species',
      linkTo: '/species',
      component: SpeciesView,
      icon: CategoryIcon,
      //TODO this is temporary, need to add species policy
      disabled:
        !hasPermission(user, [POLICIES.SUPER_PERMISSION, POLICIES.LIST_TREE]) ||
        !user ||
        user.policy.organization !== undefined,
    },
    {
      name: 'Settings',
      linkTo: '/settings',
      component: Unauthorized,
      icon: IconSettings,
      disabled: true,
    },
    {
      name: 'User Manager',
      linkTo: '/user-manager',
      component: Users,
      icon: IconGroup,
      disabled: !hasPermission(user, [POLICIES.SUPER_PERMISSION]),
    },
    {
      name: 'Account',
      linkTo: '/account',
      component: Account,
      icon: IconPermIdentity,
      disabled: false,
    },
    {
      name: 'Inbox',
      linkTo: '/messaging',
      component: MessagingView,
      icon: InboxRounded,
      disabled:
        process.env.REACT_APP_ENABLE_MESSAGING !== 'true' ||
        !hasPermission(user, [
          POLICIES.SUPER_PERMISSION,
          POLICIES.SEND_MESSAGES,
        ]),
    },
  ];
}

export const AppProvider = (props) => {
  const localUser = JSON.parse(localStorage.getItem('user'));
  const [user, setUser] = useState(undefined);
  const [token, setToken] = useState(undefined);
  const [routes, setRoutes] = useState(getRoutes(localUser));
  const [userHasOrg, setUserHasOrg] = useState(false);
  const [orgList, setOrgList] = useState([]);

  // check if the user has an org load organizations when the user changes
  useEffect(() => {
    if (user && token) {
      loadOrganizations();
    }
    setUserHasOrg(!!user?.policy?.organization?.id);
  }, [user, token]);

  function checkSession() {
    const localToken = JSON.parse(localStorage.getItem('token'));
    const localUser = JSON.parse(localStorage.getItem('user'));
    if (localToken && localUser) {
      // Temporarily log in with the localStorage credentials while
      // we check that the session is still valid
      login(localUser, localToken);

      axios
        .get(
          `${process.env.REACT_APP_API_ROOT}/auth/check_session?id=${localUser.id}`,
          {
            headers: {
              Authorization: localToken,
            },
          }
        )
        .then((response) => {
          if (response.status === 200) {
            if (response.data.token === undefined) {
              //the role has not changed
              login(localUser, localToken, true);
            } else {
              //role has changed, update the token
              login(localUser, response.data.token, true);
            }
          } else {
            logout();
          }
        });
      return true;
    }
    return false;
  }

  function login(newUser, newToken, rememberDetails) {
    // This api gets hit with identical users from multiple login calls
    if (!isEqual(session.user, newUser)) {
      setUser(newUser);
      session.user = newUser;
      if (rememberDetails) {
        localStorage.setItem('user', JSON.stringify(newUser));
      }

      // By not updating routes object, we can memoize the menu and routes better
      setRoutes(getRoutes(newUser));
    }

    if (session.token !== newToken) {
      session.token = newToken;
      setToken(newToken);

      if (rememberDetails) {
        localStorage.setItem('token', JSON.stringify(newToken));
      }
    }
  }

  function logout() {
    setUser(undefined);
    setToken(undefined);
    setRoutes(getRoutes(undefined));
    session.token = undefined;
    session.user = undefined;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  async function loadOrganizations() {
    const orgs = await api.getOrganizations();
    console.log('load organizations from api:', orgs.length);
    setOrgList(orgs);
  }

  const value = {
    login,
    logout,
    user,
    token,
    routes,
    orgList,
    userHasOrg,
  };

  if (!user || !token) {
    checkSession();
  }

  // VerifyProvider and GrowerProvider need to wrap children here so that they are available when needed
  return (
    <AppContext.Provider value={value}>
      <MessagingProvider>{props.children}</MessagingProvider>
    </AppContext.Provider>
  );
};
