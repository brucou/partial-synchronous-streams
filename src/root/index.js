// TODO : udpate with routes and logic
import "normalize-css"
import "snabbdom-material/lib/index.css"
import "./styles.scss"

import { Observable as $ } from "rx"
import { a, div, h3, i, li, p, ul } from "cycle-snabbdom"
import { m } from "rx-component-combinators"
import { onRoute } from "../router"

// Route definitions at this level
// TODO : use my router
const routes = {
  '/applyTo/:key': undefined,
}

/**
 * FIXTURES
 */
let App = { Group: {}, User: {} }

App.Group.FIXTURES = [{
  id: 1,
  name: "Group one",
  details: "details for Group one",
  users: [1, 2]

}, {
  id: 2,
  name: "Group two",
  details: "details for Group two",
  users: [2]
}]

App.User.FIXTURES = [{
  id: 1,
  name: "Tom",
  details: "I am the Cat !",
  groups: [1]

}, {
  id: 2,
  name: "Jerry",
  details: "I am the Mouse !",
  groups: [2]
}]

const groups = App.Group.FIXTURES
const users = App.User.FIXTURES

/**
 * Rendering functions
 */
function renderGroups(groups) {
  return div([
    h3('Groups'),
    p('Click on a group to display corresponding users'),
    div({ style: '' }, [
      ul(
        groups.map(group => li([
          a({
            "attrs": { "href": `/group/${group.id}` }
          }, [group.name])
        ]))
      )
    ])
  ])
}

function renderUsers(groupID, userIDs) {
  const users = userIDs.map(x => App.User.FIXTURES[x - 1])

  return div([
    h3('Users'),
    p('Click on an user to display the details'),
    div([
      ul(
        users.map(user => li([
          a({
            "attrs": {"href": `/group/${groupID}/user/${user.id}`}
          }, [user.name])
        ]))
      )
    ])
  ])
}

function renderDetails(model) {
  return div([
    h3(`Details for ${model.name}`),
    div([
      i(`${model.details}`)
    ])
  ])
}

/**
 * Component definitions
 */
const showUsersCore = {
  makeOwnSinks: function showUsersCore(sources, settings) {
    const groupID = settings.routeParams.groupId

    return {
      DOM: $.of(renderUsers(groupID, groups[groupID - 1].users))
    }
  }
}

const showGroupCore = {
  makeLocalSources: function makeShowGroupCoreExtraSources(sources) {
    const route$ = sources.router.observable.map(routeStruct => {
        const route = routeStruct.pathname;
        console.warn('pathname', route)

        return (route && route[0] === '/') ? route.substring(1) : route
      }
    )

    return {
      route$: route$
    }
  },
  makeOwnSinks: function showGroupCore(sources, settings) {
    return {
      DOM: $.of(renderGroups(groups))
    }
  }
}

function showGroupCore(sources, settings) {
  return {
    DOM: $.of(renderGroups(groups))
  }
}

const showUserDetails = function showUserDetails(sources, settings) {
  const userID = settings.routeParams.userId

  return {
    DOM: $.of(renderDetails(users[userID - 1]))
  }
}

const showGroupDetails = m(showUsersCore, {}, [
  onRoute('user/:userId', [
    showUserDetails
  ])
])

// !!TODO : configure by settings the field for the router sink, here it is router, not route$
// TODO : replace the local router by the router from component-combinator
// TODO : see if showGroupCore can go as a component together with the onRoutes...
const Root = m(showGroupCore, { sinkNames: ['DOM', 'router'] }, [
  onRoute('group/:groupId', [
    showGroupDetails
  ])
])

export default Root
