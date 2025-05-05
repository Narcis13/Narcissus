import * as moment from 'moment-timezone';

export const getRomaniaDate = (): Date => {
    return new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Europe/Bucharest' })
    );
  };

  export const getRomanianDate = (): Date => {
    return moment().tz('Europe/Bucharest').toDate();
  }; 