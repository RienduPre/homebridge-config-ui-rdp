import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ToastrService } from 'ngx-toastr';

import { WsService } from '../_services/ws.service';
import { ApiService } from '../_services/api.service';
import { AuthService } from '../_services/auth.service';
import { PluginService } from '../_services/plugin.service';

interface HomebridgeStatus {
  consolePort?: number;
  port?: number;
  pin?: string;
  status?: string;
  qrcode?: string;
  packageVersion?: string;
}

@Component({
  selector: 'app-status',
  templateUrl: './status.component.html'
})
export class StatusComponent implements OnInit {
  @ViewChild('qrcode') qrcode: ElementRef;

  private onOpen;
  private onClose;
  private onMessageStats;
  private onMessageServer;
  public server: HomebridgeStatus = {};
  public stats: any = {};
  public homebridge: any = {};
  public teamviewer: any = {};

  public loadedQrCode = false;
  public consoleStatus;

  constructor(
    private ws: WsService,
    public $auth: AuthService,
    public $plugin: PluginService,
    private $api: ApiService,
    public toastr: ToastrService,
    ) {}

  ngOnInit() {
    // subscribe to status events
    if (this.ws.socket.readyState) {
      this.ws.subscribe('status');
      this.consoleStatus = 'up';
      this.checkHomebridgeVersion();
      this.checkTeamviewer();
    }

    this.onOpen = this.ws.open.subscribe(() => {
      this.ws.subscribe('status');
      this.consoleStatus = 'up';
      this.checkHomebridgeVersion();
      this.checkTeamviewer();
    });

    // listen for to stats data
    this.onMessageStats = this.ws.handlers.stats.subscribe((data) => {
      this.stats = data;
    });

    // listen for server data
    this.onMessageServer = this.ws.handlers.server.subscribe((data) => {
      this.server = data;
      this.getQrCodeImage();

      // check if client is up-to-date
      if (this.server.packageVersion && this.server.packageVersion !== this.$auth.env.packageVersion) {
        window.location.reload(true);
      }
    });

    this.onClose = this.ws.close.subscribe(() => {
      this.consoleStatus = 'down';
      this.server.status = 'down';
      this.loadedQrCode = false;
    });
  }

  checkHomebridgeVersion() {
    return this.$api.getHomebridgePackage().subscribe(
      data => this.homebridge = data,
    );
  }

  checkTeamviewer() {
    return this.$api.getTeamviewerStatus().subscribe(
      data => this.teamviewer = data,
    );
  }

  getQrCodeImage() {
    if (!this.loadedQrCode) {
      return this.$api.getQrCode().subscribe(
        (svg) => {
          this.qrcode.nativeElement.innerHTML = svg;
          this.loadedQrCode = true;
        },
        (err) => {
          this.loadedQrCode = false;
        }
      );
    }
  }

  // tslint:disable-next-line:use-life-cycle-interface
  ngOnDestroy() {
    try {
      // unsubscribe from log events
      this.ws.unsubscribe('status');

      // unsubscribe listeners
      this.onOpen.unsubscribe();
      this.onClose.unsubscribe();
      this.onMessageStats.unsubscribe();
      this.onMessageServer.unsubscribe();
    } catch (e) { }
  }

  stopTeamviewer() {
    if (confirm("Are you sure you want to stop TeamViewer?")) {
      this.teamviewer = {};
      this.$api.stopTeamviewer().subscribe(d => {
        setTimeout(() => this.checkTeamviewer(), 1000);
      });
    }
  }

  startTeamviewer() {
    if (confirm("Are you sure you want to start TeamViewer?")) {
      this.teamviewer = {};
      this.$api.startTeamviewer().subscribe(d => {
        setTimeout(() => this.checkTeamviewer(), 1000);
      });
    }
  }

}

export const StatusStates = {
  name: 'status',
  url: '/',
  component: StatusComponent,
  data: {
    requiresAuth: true
  }
};

