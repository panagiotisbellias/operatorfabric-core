/* Copyright (c) 2021-2023, RTE (http://www.rte-france.com)
 * See AUTHORS.txt
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 * SPDX-License-Identifier: MPL-2.0
 * This file is part of the OperatorFabric project.
 */

import {Component, Input, OnChanges, OnDestroy, OnInit} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import {ConfigService} from 'app/business/services/config.service';
import {CountDown} from '../../../business/common/countdown/countdown';

@Component({
    selector: 'of-countdown',
    templateUrl: './countdown.component.html',
    styleUrls: ['./countdown.component.scss']
})
export class CountDownComponent implements OnInit, OnDestroy, OnChanges {
    @Input() public lttd: number;
    @Input() public expiredLabel: string;
    @Input() public showExpiredLabel: boolean = true;
    @Input() public showExpiredIcon: boolean = true;

    public countDown;
    public translatedExpiredLabel: string;
    secondsBeforeLttdForClockDisplay: number;

    constructor(private translate: TranslateService) {}

    ngOnInit() {
        this.secondsBeforeLttdForClockDisplay = ConfigService.getConfigValue(
            'feed.card.secondsBeforeLttdForClockDisplay',
            false
        );
        this.countDown = new CountDown(this.lttd, this.secondsBeforeLttdForClockDisplay);
    }

    ngOnChanges() {
        this.translatedExpiredLabel = this.translate.instant(this.expiredLabel);

        if (this.countDown) {
            this.countDown.stopCountDown();
            this.countDown = new CountDown(this.lttd, this.secondsBeforeLttdForClockDisplay);
        }
    }
    ngOnDestroy(): void {
        this.countDown.stopCountDown();
    }
}
