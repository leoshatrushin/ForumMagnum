import { Components, registerComponent, } from '../../lib/vulcan-lib';
import React, { useState, useEffect } from 'react';
import { useUserLocation } from '../../lib/collections/users/helpers';
import { useCurrentUser } from '../common/withUser';
import { createStyles } from '@material-ui/core/styles';
import * as _ from 'underscore';
import FilterIcon from '@material-ui/icons/FilterList';
import NotificationsIcon from '@material-ui/icons/Notifications';
import NotificationsNoneIcon from '@material-ui/icons/NotificationsNone';
import { useDialog } from '../common/withDialog'
import {AnalyticsContext} from "../../lib/analyticsEvents";
import { useUpdate } from '../../lib/crud/withUpdate';
import { pickBestReverseGeocodingResult } from '../../server/mapsUtils';
import { useGoogleMaps, geoSuggestStyles } from '../form-components/LocationFormComponent';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import { useMulti } from '../../lib/crud/withMulti';
import { getBrowserLocalStorage } from '../async/localStorageHandlers';
import Geosuggest from 'react-geosuggest';
import Button from '@material-ui/core/Button';
import { forumTypeSetting } from '../../lib/instanceSettings';
import { EVENT_TYPES } from '../../lib/collections/posts/custom_fields';
import OutlinedInput from '@material-ui/core/OutlinedInput';
import classNames from 'classnames';

const styles = createStyles((theme: ThemeType): JssStyles => ({
  section: {
    maxWidth: 1200,
    padding: 20,
    margin: 'auto',
  },
  sectionHeadingRow: {
    display: 'flex',
    justifyContent: 'space-between',
    maxWidth: 700,
    margin: '40px auto',
    '@media (max-width: 812px)': {
      flexDirection: 'column',
      margin: '30px auto',
    }
  },
  sectionHeading: {
    flex: 'none',
    ...theme.typography.headline,
    fontSize: 34,
    margin: 0
  },
  sectionDescription: {
    ...theme.typography.commentStyle,
    textAlign: 'left',
    fontSize: 15,
    lineHeight: '1.8em',
    marginLeft: 60,
    '@media (max-width: 812px)': {
      marginTop: 10,
      marginLeft: 0
    }
  },
  filters: {
    gridColumnStart: 1,
    gridColumnEnd: -1,
    display: 'flex',
    alignItems: 'baseline',
    columnGap: 10,
  },
  where: {
    flex: '1 0 0',
    ...theme.typography.commentStyle,
    fontSize: 13,
    color: "rgba(0,0,0,0.6)",
    paddingLeft: 3
  },
  geoSuggest: {
    ...geoSuggestStyles(theme),
    display: 'inline-block',
    minWidth: 200,
    marginLeft: 6
  },
  filterIcon: {
    alignSelf: 'center',
    fontSize: 20
  },
  filter: {
    '& .MuiOutlinedInput-input': {
      paddingRight: 30
    },
  },
  formatFilter: {
    '@media (max-width: 812px)': {
      display: 'none'
    }
  },
  placeholder: {
    color: "rgba(0,0,0,0.4)",
  },
  notifications: {
    flex: '1 0 0',
    textAlign: 'right'
  },
  notificationsBtn: {
    textTransform: 'none',
    fontSize: 14,
  },
  notificationsIcon: {
    fontSize: 18,
    marginRight: 6
  },
  eventCards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 373px)',
    gridGap: '20px',
    justifyContent: 'center',
    marginTop: 16,
    [theme.breakpoints.down('md')]: {
      gridTemplateColumns: 'repeat(2, 373px)',
    },
    '@media (max-width: 812px)': {
      gridTemplateColumns: 'auto',
    }
  },
  loadMoreRow: {
    gridColumnStart: 1,
    gridColumnEnd: -1,
  },
  loadMore: {
    ...theme.typography.commentStyle,
    background: 'none',
    color: theme.palette.primary.main,
    fontSize: 16,
    padding: 0,
    '&:hover': {
      color: '#085d6c',
    }
  },
  loading: {
    display: 'inline-block'
  },
}))


const EventsHome = ({classes}: {
  classes: ClassesType,
}) => {
  const currentUser = useCurrentUser();
  const { openDialog } = useDialog();
  
  // in-person, online, or all
  const [modeFilter, setModeFilter] = useState('all')
  // ex. presentation, discussion, course, etc. (see EVENT_TYPES for full list)
  const [formatFilter, setFormatFilter] = useState<Array<string>>([])

  // used to set the user's location if they did not already have one
  const { mutate: updateUser } = useUpdate({
    collectionName: "Users",
    fragmentName: 'UsersProfile',
  });
  
  /**
   * Given a location, update the page query to use that location,
   * then save it to the user's settings (if they are logged in)
   * or to the browser's local storage (if they are logged out).
   *
   * @param {Object} location - The location to save for the user.
   * @param {number} location.lat - The location's latitude.
   * @param {number} location.lng - The location's longitude.
   * @param {Object} location.gmaps - The Google Maps location data.
   * @param {string} location.gmaps.formatted_address - The user-facing address (ex: Cambridge, MA, USA).
   */
  const saveUserLocation = ({lat, lng, gmaps}) => {
    // save it in the page state
    userLocation.setLocationData({lat, lng, loading: false, known: true, label: gmaps.formatted_address})

    if (currentUser) {
      // save it on the user document
      void updateUser({
        selector: {_id: currentUser._id},
        data: {
          location: gmaps.formatted_address,
          googleLocation: gmaps
        }
      })
    } else {
      // save it in local storage
      const ls = getBrowserLocalStorage()
      try {
        ls?.setItem('userlocation', JSON.stringify({lat, lng, known: true, label: gmaps.formatted_address}))
      } catch(e) {
        // eslint-disable-next-line no-console
        console.error(e);
      }
    }
  }
  
  // if the current user provides their browser location and we don't have a location saved for them,
  // save it accordingly
  const [mapsLoaded, googleMaps] = useGoogleMaps("CommunityHome")
  const [geocodeError, setGeocodeError] = useState(false)
  const saveReverseGeocodedLocation = async ({lat, lng, known}) => {
    if (
      mapsLoaded &&     // we need Google Maps to be loaded before we can call the Geocoder
      !geocodeError &&  // if we've ever gotten a geocoding error, don't try again
      known             // skip if we've received the default location
    ) {
      try {
        // get a list of matching Google locations for the current lat/lng (reverse geocoding)
        const geocoder = new googleMaps.Geocoder();
        const geocodingResponse = await geocoder.geocode({
          location: {lat, lng}
        });
        const results = geocodingResponse?.results;
        
        if (results?.length) {
          const location = pickBestReverseGeocodingResult(results)
          saveUserLocation({lat, lng, gmaps: location})
        } else {
          // update the page state to indicate that we're not waiting on a location name
          userLocation.setLocationData({...userLocation, label: null})
        }
      } catch (e) {
        setGeocodeError(true)
        // eslint-disable-next-line no-console
        console.error(e?.message)
        // update the page state to indicate that we're not waiting on a location name
        userLocation.setLocationData({...userLocation, label: null})
      }
    }
  }

  // on page load, try to get the user's location from:
  // 1. (logged in user) user settings
  // 2. (logged out user) browser's local storage
  // 3. failing those, browser's geolocation API (which we then try to save in #1 or #2)
  const userLocation = useUserLocation(currentUser)
  
  useEffect(() => {
    // if we've gotten a location from the browser's geolocation API, save it
    if (!userLocation.loading && userLocation.known && userLocation.label === '') {
      void saveReverseGeocodedLocation(userLocation)
    }
    //eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation])

  const openEventNotificationsForm = () => {
    openDialog({
      componentName: currentUser ? "EventNotificationsDialog" : "LoginPopup",
    });
  }
  
  const { HighlightedEventCard, EventCards, Loading } = Components
  
  // on the EA Forum, we insert some special event cards (ex. Intro VP card)
  let numSpecialCards = currentUser ? 1 : 2
  // hide them on other forums, and when certain filters are set
  if (forumTypeSetting.get() !== 'EAForum' || modeFilter === 'in-person' || (formatFilter.length > 0 && !formatFilter.includes('course'))) {
    numSpecialCards = 0
  }

  const filters: PostsViewTerms = {}
  if (modeFilter === 'in-person') {
    filters.onlineEvent = false
  } else if (modeFilter === 'online') {
    filters.onlineEvent = true
  }
  if (formatFilter.length) {
    filters.eventType = formatFilter
  }
  
  const eventsListTerms: PostsViewTerms = userLocation.known ? {
    view: 'nearbyEvents',
    lat: userLocation.lat,
    lng: userLocation.lng,
    ...filters,
  } : {
    view: 'globalEvents',
    ...filters,
  }
  
  const { results, loading, showLoadMore, loadMore } = useMulti({
    terms: eventsListTerms,
    collectionName: "Posts",
    fragmentName: 'PostsList',
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: "cache-first",
    limit: 12 - numSpecialCards,
    itemsPerPage: 12,
    skip: userLocation.loading
  });
  
  // we try to highlight the event most relevant to you
  let highlightedEvent: PostsList|undefined;
  if (results && results.length > 0) {
    // first, try to find the next in-person event near you
    results.forEach(result => {
      if (!highlightedEvent && !result.onlineEvent) {
        highlightedEvent = result
      }
    })
    // if none, then try to find the next "local" online event near you
    results.forEach(result => {
      if (!highlightedEvent && !result.globalEvent) {
        highlightedEvent = result
      }
    })
    // otherwise, just show the first event in the list
    if (!highlightedEvent) highlightedEvent = results[0]
  }
  
  let loadMoreButton = showLoadMore && <button className={classes.loadMore} onClick={() => loadMore(null)}>
    Load More
  </button>
  if (loading && results?.length) {
    loadMoreButton = <div className={classes.loading}><Loading /></div>
  }

  return (
    <AnalyticsContext pageContext="EventsHome">
      <div>
        <HighlightedEventCard event={highlightedEvent} loading={loading || userLocation.loading} />
      </div>

      <div className={classes.section}>
        <div className={classes.sectionHeadingRow}>
          <h1 className={classes.sectionHeading}>
            Events
          </h1>
          <div className={classes.sectionDescription}>
            Join people from around the world for discussions, talks, and other events on how we can tackle
            the world's biggest problems.
          </div>
        </div>

        <div className={classes.eventCards}>
          <div className={classes.filters}>
            <div className={classes.where}>
              Showing events near {mapsLoaded
                && <div className={classes.geoSuggest}>
                    <Geosuggest
                      placeholder="search for a location"
                      onSuggestSelect={(suggestion) => {
                        if (suggestion?.location) {
                          saveUserLocation({
                            ...suggestion.location,
                            gmaps: suggestion.gmaps
                          })
                        }
                      }}
                      initialValue={userLocation?.label}
                    />
                  </div>
              }
            </div>
          </div>
          
          <div className={classes.filters}>
            <FilterIcon className={classes.filterIcon} />
            <Select
              className={classes.filter}
              value={modeFilter}
              input={<OutlinedInput labelWidth={0} />}
              onChange={(e) => setModeFilter(e.target.value)}>
                <MenuItem key="all" value="all">In-person and online</MenuItem>
                <MenuItem key="in-person" value="in-person">In-person only</MenuItem>
                <MenuItem key="online" value="online">Online only</MenuItem>
            </Select>
            <Select
              className={classNames(classes.filter, classes.formatFilter)}
              value={formatFilter}
              input={<OutlinedInput labelWidth={0} />}
              onChange={e => {
                // MUI documentation says e.target.value is always an array: https://mui.com/components/selects/#multiple-select
                // @ts-ignore
                setFormatFilter(e.target.value)
              }}
              multiple
              displayEmpty
              renderValue={(selected: Array<string>) => {
                if (selected.length === 0) {
                  return <em className={classes.placeholder}>Filter by format</em>
                }
                // if any options are selected, display them separated by commas
                return selected.map(type => EVENT_TYPES.find(t => t.value === type)?.label).join(', ')
              }}>
                {EVENT_TYPES.map(type => {
                  return <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                })}
            </Select>
            
            <div className={classes.notifications}>
              <Button variant="text" color="primary" onClick={openEventNotificationsForm} className={classes.notificationsBtn}>
                {currentUser?.nearbyEventsNotifications ? <NotificationsIcon className={classes.notificationsIcon} /> : <NotificationsNoneIcon className={classes.notificationsIcon} />} Notify me
              </Button>
            </div>
          </div>

          <EventCards events={results} loading={loading || userLocation.loading} numDefaultCards={6} hideSpecialCards={!numSpecialCards} />
          
          <div className={classes.loadMoreRow}>
            {loadMoreButton}
          </div>
        </div>
        
      </div>
    </AnalyticsContext>
  )
}

const EventsHomeComponent = registerComponent('EventsHome', EventsHome, {styles});

declare global {
  interface ComponentTypes {
    EventsHome: typeof EventsHomeComponent
  }
}