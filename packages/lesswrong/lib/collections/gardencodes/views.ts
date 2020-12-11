import { eventTypes, GardenCodes } from './collection';
import { ensureIndex } from '../../collectionUtils';


GardenCodes.addDefaultView(terms => {
  let selector 
  if (terms?.types) {
    const eventTypeStrings = eventTypes.map(type=>type.value)
    const types = terms.types?.filter(type => eventTypeStrings.includes(type))
    if (!types?.length) {
      throw Error("You didn't provide a valid type")
    }
    selector = {
      type: {$in: types},
      deleted: false
    }
  } else if (terms?.userId) {
    selector = {
      userId: terms.userId,
      deleted: false
    }
  } else if (!terms?.code) {
    selector = {
      keyDoesNotExist: "valueDoesNotExist"
    }
  }
  return {
    selector: selector || {
      code: terms.code,
      deleted: false
    },
    options: {
      sort: { 
        startTime: 1
      }
    }
  }
})

ensureIndex(GardenCodes, {code:1, deleted: 1});
ensureIndex(GardenCodes, {userId:1, deleted: 1});

GardenCodes.addView("userGardenCodes", function (terms) {
  const twoHoursAgo = new Date(new Date().getTime()-(2*60*60*1000));
  return {
    selector: { 
      startTime: {$gt: twoHoursAgo }
    }
  }
})

ensureIndex(GardenCodes, {code: 1, deleted: 1, userId: 1, });

GardenCodes.addView("semipublicGardenCodes", function (terms) {
  const twoHoursAgo = new Date(new Date().getTime()-(2*60*60*1000));
  return {
    selector: { 
      startTime: {$gt: twoHoursAgo }
    }
  }
})

ensureIndex(GardenCodes, {code: 1, deleted: 1, userId: 1, });
