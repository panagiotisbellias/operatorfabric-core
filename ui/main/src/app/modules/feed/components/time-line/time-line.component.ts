

import { Component, OnInit, OnDestroy } from '@angular/core';
import { of, Subscription } from 'rxjs';
import { select, Store } from '@ngrx/store';
import { catchError} from 'rxjs/operators';
import { AppState } from '@ofStore/index';
import * as _ from 'lodash';
import { buildConfigSelector } from '@ofStore/selectors/config.selectors';
import { buildSettingsOrConfigSelector } from '@ofStore/selectors/settings.x.config.selectors';
import * as moment from 'moment';

@Component({
    selector: 'of-time-line',
    templateUrl: './time-line.component.html',
})
export class TimeLineComponent implements OnInit, OnDestroy {

    localSubscription: Subscription;

    public confDomain = [];
    public domains: any;


    constructor(private store: Store<AppState>) { }
    ngOnInit() {

        this.loadConfiguration();
        this.loadDomainsListFromConfiguration();

        this.localSubscription = this.store.select(buildSettingsOrConfigSelector('locale')).subscribe(
            l => moment.locale(l)
        )

    }

    loadConfiguration() {
    
        this.domains = {
            J: {
                buttonTitle: 'timeline.buttonTitle.J',
                domainId:'J',
            }, TR: {
                buttonTitle: 'timeline.buttonTitle.TR',
                domainId : 'TR',
            }, '7D': {
                buttonTitle: 'timeline.buttonTitle.7D',
                domainId:'7D',
                followClockTick: true
            }, 'W': {
                buttonTitle: 'timeline.buttonTitle.W',
                domainId : 'W',
                followClockTick: false
            }, M: {
                buttonTitle: 'timeline.buttonTitle.M',
                domainId : 'M',
                followClockTick: false
            }, Y: {
                buttonTitle: 'timeline.buttonTitle.Y',
                domainId: 'Y',
                followClockTick: false
            }
        };

    }


    loadDomainsListFromConfiguration() {
        this.store.pipe(select(buildConfigSelector('feed.timeline.domains')), catchError(() => of([]))).subscribe(d => {
            if (d) {
                d.map(domain => {
                    if (Object.keys(this.domains).includes(domain)) {
                        this.confDomain.push(this.domains[domain]);
                    }
                });
            }
            
        });
    }


    ngOnDestroy() {

        if (this.localSubscription) {
            this.localSubscription.unsubscribe();
        }
        
    }
}
